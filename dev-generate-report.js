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
  'test-files/components/Login.jsx': new Set([11, 12, 13, 22, 23, 24, 25, 32, 33]),
  'test-files/large-utils.js': new Set([
    // Changes at the top (uncovered functions)
    5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    // Changes in the middle (covered functions)
    50, 51, 52, 53, 54, 100, 101, 102, 200, 201, 202, 300, 301, 302, 400, 401, 402, 500, 501, 502,
    // Changes at the bottom (uncovered functions) 
    880, 881, 882, 883, 884, 885, 900, 901, 902, 903, 904, 905, 920, 921, 922, 923, 924, 925
  ])
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
  },
  {
    file: 'test-files/large-utils.js',
    lines: {
      details: [
        // Top functions - NOT COVERED (lines 1-30)
        { line: 1, hit: 1 },  // comment/imports covered
        { line: 2, hit: 1 },
        { line: 5, hit: 0 },   // changed, not covered - uncoveredTopFunction1
        { line: 6, hit: 0 },   // changed, not covered
        { line: 7, hit: 0 },   // changed, not covered
        { line: 8, hit: 0 },   // changed, not covered
        { line: 9, hit: 0 },   // changed, not covered
        { line: 10, hit: 0 },  // changed, not covered - uncoveredTopFunction2
        { line: 11, hit: 0 },  // changed, not covered
        { line: 12, hit: 0 },  // changed, not covered
        { line: 13, hit: 0 },  // changed, not covered
        { line: 14, hit: 0 },  // changed, not covered
        { line: 15, hit: 0 },  // changed, not covered
        { line: 16, hit: 0 },  // changed, not covered - uncoveredTopFunction3
        { line: 17, hit: 0 },  // changed, not covered
        { line: 18, hit: 0 },  // changed, not covered
        { line: 19, hit: 0 },  // changed, not covered
        { line: 20, hit: 0 },  // changed, not covered
        { line: 21, hit: 0 },  // changed, not covered
        { line: 22, hit: 0 },  // changed, not covered
        { line: 23, hit: 0 },  // changed, not covered
        { line: 24, hit: 0 },  // changed, not covered
        
        // Middle functions - COVERED (lines 25-870)
        { line: 25, hit: 1 },
        { line: 30, hit: 1 },
        { line: 40, hit: 1 },
        { line: 50, hit: 1 },  // changed, covered - mathUtils
        { line: 51, hit: 1 },  // changed, covered
        { line: 52, hit: 1 },  // changed, covered
        { line: 53, hit: 1 },  // changed, covered
        { line: 54, hit: 1 },  // changed, covered
        { line: 60, hit: 1 },
        { line: 70, hit: 1 },
        { line: 80, hit: 1 },
        { line: 90, hit: 1 },
        { line: 100, hit: 1 }, // changed, covered - stringUtils
        { line: 101, hit: 1 }, // changed, covered
        { line: 102, hit: 1 }, // changed, covered
        { line: 120, hit: 1 },
        { line: 150, hit: 1 },
        { line: 200, hit: 1 }, // changed, covered - arrayUtils
        { line: 201, hit: 1 }, // changed, covered
        { line: 202, hit: 1 }, // changed, covered
        { line: 250, hit: 1 },
        { line: 280, hit: 1 },
        { line: 300, hit: 1 }, // changed, covered - dateUtils
        { line: 301, hit: 1 }, // changed, covered
        { line: 302, hit: 1 }, // changed, covered
        { line: 350, hit: 1 },
        { line: 400, hit: 1 }, // changed, covered - validationUtils
        { line: 401, hit: 1 }, // changed, covered
        { line: 402, hit: 1 }, // changed, covered
        { line: 450, hit: 1 },
        { line: 500, hit: 1 }, // changed, covered - colorUtils
        { line: 501, hit: 1 }, // changed, covered
        { line: 502, hit: 1 }, // changed, covered
        { line: 550, hit: 1 },
        { line: 600, hit: 1 },
        { line: 650, hit: 1 },
        { line: 700, hit: 1 },
        { line: 750, hit: 1 },
        { line: 800, hit: 1 },
        { line: 850, hit: 1 },
        { line: 870, hit: 1 },
        
        // Bottom functions - NOT COVERED (lines 875-925)
        { line: 875, hit: 1 },  // exports still covered
        { line: 880, hit: 0 },  // changed, not covered - uncoveredBottomFunction1
        { line: 881, hit: 0 },  // changed, not covered
        { line: 882, hit: 0 },  // changed, not covered
        { line: 883, hit: 0 },  // changed, not covered
        { line: 884, hit: 0 },  // changed, not covered
        { line: 885, hit: 0 },  // changed, not covered
        { line: 890, hit: 1 },
        { line: 900, hit: 0 },  // changed, not covered - uncoveredBottomFunction2
        { line: 901, hit: 0 },  // changed, not covered
        { line: 902, hit: 0 },  // changed, not covered
        { line: 903, hit: 0 },  // changed, not covered
        { line: 904, hit: 0 },  // changed, not covered
        { line: 905, hit: 0 },  // changed, not covered
        { line: 910, hit: 1 },
        { line: 920, hit: 0 },  // changed, not covered - uncoveredBottomFunction3
        { line: 921, hit: 0 },  // changed, not covered
        { line: 922, hit: 0 },  // changed, not covered
        { line: 923, hit: 0 },  // changed, not covered
        { line: 924, hit: 0 },  // changed, not covered
        { line: 925, hit: 0 },  // changed, not covered
        { line: 926, hit: 1 }   // final line covered
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
}`,

  'test-files/large-utils.js': `/**
 * Large utility module for testing code coverage display
 * This file intentionally has ~1000 lines with coverage gaps at top and bottom
 */

// These functions at the top will NOT be covered by tests
function uncoveredTopFunction1() {
  console.log('This function is not covered');
  return 'uncovered';
}

function uncoveredTopFunction2(param) {
  if (param > 0) {
    return param * 2;
  }
  return 0;
}

function uncoveredTopFunction3() {
  const data = {
    name: 'test',
    value: 42
  };
  return data;
}

// These functions WILL be covered by tests
function mathUtils() {
  return {
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    multiply: (a, b) => a * b,
    divide: (a, b) => b !== 0 ? a / b : null
  };
}

function stringUtils() {
  return {
    capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
    reverse: (str) => str.split('').reverse().join(''),
    slugify: (str) => str.toLowerCase().replace(/\\s+/g, '-'),
    truncate: (str, length) => str.length > length ? str.slice(0, length) + '...' : str
  };
}

function arrayUtils() {
  return {
    chunk: (array, size) => {
      const chunks = [];
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
      }
      return chunks;
    },
    flatten: (array) => array.reduce((flat, item) => flat.concat(item), []),
    unique: (array) => [...new Set(array)],
    shuffle: (array) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
  };
}

function dateUtils() {
  return {
    formatDate: (date) => {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    },
    addDays: (date, days) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    },
    getDayOfWeek: (date) => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[date.getDay()];
    },
    isWeekend: (date) => {
      const day = date.getDay();
      return day === 0 || day === 6;
    }
  };
}

function validationUtils() {
  return {
    isEmail: (email) => {
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      return emailRegex.test(email);
    },
    isPhone: (phone) => {
      const phoneRegex = /^\\(\\d{3}\\) \\d{3}-\\d{4}$/;
      return phoneRegex.test(phone);
    },
    isUrl: (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },
    isStrongPassword: (password) => {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
      const isLongEnough = password.length >= 8;
      return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && isLongEnough;
    }
  };
}

function colorUtils() {
  return {
    hexToRgb: (hex) => {
      const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    },
    rgbToHex: (r, g, b) => {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    getRandomColor: () => {
      return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    },
    lightenColor: (color, amount) => {
      const usePound = color[0] === '#';
      const col = usePound ? color.slice(1) : color;
      const num = parseInt(col, 16);
      let r = (num >> 16) + amount;
      let g = (num >> 8 & 0x00FF) + amount;
      let b = (num & 0x0000FF) + amount;
      if (r > 255) r = 255;
      if (g > 255) g = 255;
      if (b > 255) b = 255;
      return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16);
    }
  };
}

// [TRUNCATED FOR BREVITY - imagine ~800 more lines of covered functions here]

// These functions at the bottom will NOT be covered by tests
function uncoveredBottomFunction1() {
  const config = {
    debug: true,
    timeout: 5000,
    retries: 3
  };
  return config;
}

function uncoveredBottomFunction2(data) {
  if (!data || data.length === 0) {
    return null;
  }
  return data.map(item => ({
    id: item.id,
    processed: true,
    timestamp: Date.now()
  }));
}

function uncoveredBottomFunction3() {
  const operations = [
    'create',
    'read', 
    'update',
    'delete'
  ];
  return operations;
}

function uncoveredBottomFunction4(input) {
  try {
    const parsed = JSON.parse(input);
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function uncoveredBottomFunction5() {
  console.log('This is an uncovered function at the bottom');
  return 'bottom-uncovered';
}

// Export all the covered functions
module.exports = {
  mathUtils,
  stringUtils,
  arrayUtils,
  dateUtils,
  validationUtils,
  colorUtils,
  storageUtils,
  networkUtils,
  performanceUtils,
  cryptoUtils,
  domUtils,
  animationUtils,
  geometryUtils,
  eventUtils,
  fileUtils,
  browserUtils,
  cookieUtils,
  formUtils,
  textUtils,
  errorUtils,
  cacheUtils,
  loggerUtils,
  deviceUtils,
  apiUtils
};`
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
