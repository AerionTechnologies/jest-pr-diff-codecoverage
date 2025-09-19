#!/usr/bin/env node

/**
 * Local development script to generate HTML coverage reports
 * This allows rapid development and testing of the HTML report generation
 * without needing to run in a GitHub Actions environment.
 */

const fs = require('fs');
const path = require('path');
const HtmlReportGenerator = require('./src/html-report-generator');
const CoverageParser = require('./src/coverage-parser');

// Sample PR data for testing
const SAMPLE_PR_DATA = {
  number: 123,
  title: 'Add new authentication feature'
};

// Sample changed lines data (simulates GitHub PR diff)
// Using separate test-files directory to avoid conflicts with real source code
const SAMPLE_CHANGED_LINES = {
  'test-files/auth.js': new Set([14, 15, 16, 24, 25, 29, 30, 31, 43]),
  'test-files/utils.js': new Set([8, 9, 15, 16, 17]),
  'test-files/app.js': new Set([5, 6, 7, 8]),
  'test-files/components/Login.jsx': new Set([11, 12, 13, 22, 23, 24, 25, 32, 33])
};

// Sample coverage data (simulates parsed Jest/LCOV data)
const SAMPLE_COVERAGE_DATA = [
  {
    file: 'test-files/auth.js',
    lines: {
      details: [
        { line: 1, hit: 1 },
        { line: 2, hit: 1 },
        { line: 10, hit: 1 },
        { line: 14, hit: 1 },  // changed, covered - function declaration
        { line: 15, hit: 1 },  // changed, covered - return statement
        { line: 16, hit: 1 },  // changed, covered - comment
        { line: 20, hit: 1 },
        { line: 24, hit: 1 },  // changed, covered - object property
        { line: 25, hit: 1 },  // changed, covered - object property
        { line: 29, hit: 0 },  // changed, not covered - function declaration
        { line: 30, hit: 0 },  // changed, not covered - try block
        { line: 31, hit: 0 },  // changed, not covered - return statement
        { line: 40, hit: 1 },
        { line: 43, hit: 1 },  // changed, covered - object property
        { line: 50, hit: 0 }
      ]
    }
  },
  {
    file: 'test-files/utils.js',
    lines: {
      details: [
        { line: 5, hit: 1 },
        { line: 8, hit: 1 },   // changed, covered - return statement
        { line: 9, hit: 1 },   // changed, covered - closing brace
        { line: 12, hit: 1 },
        { line: 15, hit: 0 },  // changed, not covered - function declaration
        { line: 16, hit: 0 },  // changed, not covered - if statement
        { line: 17, hit: 0 },  // changed, not covered - return statement
        { line: 25, hit: 1 }
      ]
    }
  },
  {
    file: 'test-files/app.js',
    lines: {
      details: [
        { line: 1, hit: 1 },
        { line: 2, hit: 1 },
        { line: 5, hit: 1 },   // changed, covered - const declaration
        { line: 6, hit: 1 },   // changed, covered - object start
        { line: 7, hit: 1 },   // changed, covered - object property
        { line: 8, hit: 1 },   // changed, covered - object property
        { line: 10, hit: 1 }
      ]
    }
  },
  {
    file: 'test-files/components/Login.jsx',
    lines: {
      details: [
        { line: 1, hit: 1 },
        { line: 5, hit: 1 },
        { line: 10, hit: 1 },
        { line: 11, hit: 1 },  // changed, covered - const declaration
        { line: 12, hit: 1 },  // changed, covered - if statement
        { line: 13, hit: 0 },  // changed, not covered - error assignment
        { line: 20, hit: 1 },
        { line: 22, hit: 1 },  // changed, covered - setErrors call
        { line: 23, hit: 0 },  // changed, not covered - return statement
        { line: 24, hit: 0 },  // changed, not covered - closing brace
        { line: 25, hit: 1 },  // changed, covered - await call
        { line: 30, hit: 1 },
        { line: 32, hit: 1 },  // changed, covered - input element
        { line: 33, hit: 1 },  // changed, covered - type attribute
        { line: 40, hit: 1 }
      ]
    }
  }
];

// Sample source files for realistic code display
const SAMPLE_SOURCE_FILES = {
  'test-files/auth.js': `import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export class AuthService {
  constructor(secretKey) {
    this.secretKey = secretKey;
  }

  async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  async validatePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
    // TODO: Add logging for failed attempts
  }

  generateToken(userId) {
    return jwt.sign(
      { userId, iat: Date.now() },
      this.secretKey,
      { expiresIn: '24h' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.secretKey);
    } catch (error) {
      return null;
    }
  }

  // New method for session management
  createSession(userId) {
    // Session logic here
    return {
      sessionId: 'session_' + userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }
}`,

  'test-files/utils.js': `export function formatDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US').format(date);
}

export function validateEmail(email) {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}`,

  'test-files/app.js': `import { AuthService } from './auth.js';
import { formatDate, validateEmail } from './utils.js';

// Initialize the application
const authService = new AuthService(process.env.JWT_SECRET);
const app = {
  auth: authService,
  utils: { formatDate, validateEmail }
};

export default app;`,

  'test-files/components/Login.jsx': `import React, { useState } from 'react';
import { validateEmail } from '../utils.js';

export function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    
    if (!validateEmail(email)) {
      newErrors.email = 'Invalid email format';
    }

    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    await onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>
    </form>
  );
}`
};

/**
 * Calculate coverage for changed lines (simulates the main logic)
 */
function calculateChangedLinesCoverage(coverageData, changedLines) {
  let totalChangedLines = 0;
  let coveredChangedLines = 0;
  const fileResults = {};

  for (const file of coverageData) {
    const normalizedPath = file.file.replace(/^\.\//, '');
    const changedLinesInFile = changedLines[normalizedPath];

    if (!changedLinesInFile || changedLinesInFile.size === 0) {
      continue;
    }

    let fileCoveredLines = 0;
    let fileTotalLines = 0;

    if (file.lines && file.lines.details) {
      for (const lineInfo of file.lines.details) {
        if (changedLinesInFile.has(lineInfo.line)) {
          fileTotalLines++;
          totalChangedLines++;
          
          if (lineInfo.hit > 0) {
            fileCoveredLines++;
            coveredChangedLines++;
          }
        }
      }
    }

    if (fileTotalLines > 0) {
      fileResults[normalizedPath] = {
        totalLines: fileTotalLines,
        coveredLines: fileCoveredLines,
        coverage: (fileCoveredLines / fileTotalLines) * 100
      };
    }
  }

  const overallCoverage = totalChangedLines > 0 ? (coveredChangedLines / totalChangedLines) * 100 : 100;

  return {
    totalLines: totalChangedLines,
    coveredLines: coveredChangedLines,
    coverage: overallCoverage,
    fileResults: fileResults
  };
}

/**
 * Create sample source files for testing
 */
function createSampleSourceFiles() {
  // Create test-files directory structure (separate from real src)
  const dirs = ['test-files', 'test-files/components'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Write sample source files
  Object.entries(SAMPLE_SOURCE_FILES).forEach(([filePath, content]) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    console.log(`📄 Created sample file: ${filePath}`);
  });
}

/**
 * Generate coverage report for local development
 */
async function generateLocalReport() {
  try {
    console.log('🚀 Generating local HTML coverage report...');
    
    // Create sample source files
    createSampleSourceFiles();
    
    // Calculate coverage results
    const coverageResults = calculateChangedLinesCoverage(SAMPLE_COVERAGE_DATA, SAMPLE_CHANGED_LINES);
    
    console.log('📊 Coverage Summary:');
    console.log(`   Overall Coverage: ${coverageResults.coverage.toFixed(2)}%`);
    console.log(`   Lines Covered: ${coverageResults.coveredLines}/${coverageResults.totalLines}`);
    console.log(`   Files Changed: ${Object.keys(coverageResults.fileResults).length}`);
    
    // Generate HTML report
    const htmlGenerator = new HtmlReportGenerator();
    const reportData = await htmlGenerator.generateReport(
      coverageResults,
      SAMPLE_CHANGED_LINES,
      SAMPLE_PR_DATA,
      SAMPLE_COVERAGE_DATA
    );
    
    console.log(`✅ HTML report generated: ${reportData.mainReport}`);
    console.log(`📁 Report directory: ${reportData.reportDir}`);
    
    // Open the report in the default browser (Windows)
    if (process.platform === 'win32') {
      const { exec } = require('child_process');
      const absolutePath = path.resolve(reportData.mainReport);
      exec(`start "" "${absolutePath}"`);
      console.log('🌐 Opening report in default browser...');
    } else {
      console.log(`🌐 Open this file in your browser: ${path.resolve(reportData.mainReport)}`);
    }
    
    console.log('\n💡 Tip: Modify the SAMPLE_* constants in this script to test different scenarios!');
    
    // Clean up test files automatically
    console.log('\n🧹 Cleaning up test files...');
    cleanupTestFiles();
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    console.error(error.stack);
    
    // Clean up test files even on error
    try {
      cleanupTestFiles();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

/**
 * Clean up test files only
 */
function cleanupTestFiles() {
  // Remove sample source files
  Object.keys(SAMPLE_SOURCE_FILES).forEach(filePath => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Removed: ${filePath}`);
    }
  });
  
  // Remove test directories
  const dirs = ['test-files/components', 'test-files'];
  dirs.forEach(dir => {
    try {
      if (fs.existsSync(dir)) {
        fs.rmdirSync(dir);
        console.log(`🗑️  Removed directory: ${dir}`);
      }
    } catch (error) {
      // Directory not empty, that's okay
    }
  });
}

/**
 * Clean up everything (test files + coverage report)
 */
function cleanup() {
  console.log('🧹 Cleaning up all generated files...');
  
  // Remove test files
  cleanupTestFiles();
  
  // Remove coverage report
  const generator = new HtmlReportGenerator();
  generator.cleanup();
  console.log('🗑️  Removed coverage report directory');
}

// Command line interface
const command = process.argv[2];

if (command === 'clean') {
  cleanup();
} else {
  generateLocalReport();
}
