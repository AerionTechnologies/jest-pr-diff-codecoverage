const fs = require('fs');
const path = require('path');

/**
 * HTML Report Generator for PR Code Coverage
 */
class HtmlReportGenerator {
  constructor() {
    this.reportDir = 'coverage-report';
  }

  /**
   * Generate HTML coverage report for changed files
   */
  async generateReport(coverageResults, changedLines, prData, coverageData = null, minimumCoverage = 80) {
    const { totalLines, coveredLines, coverage, fileResults } = coverageResults;
    
    // Create report directory
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    // Generate expandable file sections within the main report
    const fileSectionsHtml = this.generateFileSectionsHtml(fileResults, changedLines, coverageData, minimumCoverage);
    
    // Create the enhanced main report with file sections
    const enhancedReportHtml = this.generateEnhancedMainReport(
      { totalLines, coveredLines, coverage, fileResults },
      prData,
      fileSectionsHtml,
      minimumCoverage
    );
    
    const mainReportPath = path.join(this.reportDir, 'index.html');
    fs.writeFileSync(mainReportPath, enhancedReportHtml);

    return {
      mainReport: mainReportPath,
      fileReports: [], // No separate files needed anymore
      reportDir: this.reportDir
    };
  }

  /**
   * Generate HTML sections for all files with expandable code views
   */
  generateFileSectionsHtml(fileResults, changedLines, coverageData, minimumCoverage) {
    return Object.entries(fileResults).map(([filePath, result]) => {
      const changedLinesSet = changedLines[filePath] || new Set();
      const fileCoverageData = this.findFileCoverageData(filePath, coverageData);
      
      // Read file content
      let fileContent = '';
      try {
        if (fs.existsSync(filePath)) {
          fileContent = fs.readFileSync(filePath, 'utf8');
        }
      } catch (error) {
        fileContent = '// Could not read file content';
      }
      
      const lines = fileContent.split('\n');
      const fileId = filePath.replace(/[/\\]/g, '_').replace(/\./g, '_');
      
      return this.generateFileSection(filePath, lines, changedLinesSet, result, fileCoverageData, fileId, minimumCoverage);
    }).join('');
  }

  /**
   * Generate enhanced main report with embedded file sections
   */
  generateEnhancedMainReport(results, prData, fileSectionsHtml, minimumCoverage) {
    const { totalLines, coveredLines, coverage, fileResults } = results;
    const timestamp = new Date().toISOString();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PR Diff Coverage Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            line-height: 1.5;
            color: #24292f;
            background-color: #f6f8fa;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .header .subtitle {
            font-size: 1.1em;
            opacity: 0.9;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f6f8fa;
            border-bottom: 1px solid #e1e4e8;
        }
        
        .summary-card {
            background: #ffffff;
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            padding: 25px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .summary-card h3 {
            font-size: 1.8em;
            margin-bottom: 5px;
            color: #0366d6;
        }
        
        .summary-card p {
            color: #586069;
            font-size: 0.95em;
        }
        
        .coverage-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 1.1em;
            margin: 10px 0;
        }
        
        .coverage-pass { background-color: #28a745; color: white; }
        .coverage-fail { background-color: #dc3545; color: white; }
        
        
        .file-section {
            border-bottom: 1px solid #e1e4e8;
        }
        
        .file-section:last-child {
            border-bottom: none;
        }
        
        .file-header {
            background: #f6f8fa;
            padding: 20px 30px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.2s ease;
        }
        
        .file-header:hover {
            background: #e1e4e8;
        }
        
        .file-header.expanded {
            background: #0366d6;
            color: white;
        }
        
        .file-title {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .file-path {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 1.1em;
            font-weight: 600;
        }
        
        .file-stats {
            display: flex;
            align-items: center;
            gap: 20px;
            font-size: 0.9em;
        }
        
        .expand-icon {
            font-size: 1.2em;
            transition: transform 0.3s ease;
        }
        
        .expand-icon.expanded {
            transform: rotate(180deg);
        }
        
        .file-content {
            display: none;
            padding: 0;
            background: white;
        }
        
        .file-content.expanded {
            display: block;
        }
        
        .code-header {
            background: #f6f8fa;
            padding: 15px 30px;
            border-bottom: 1px solid #e1e4e8;
        }
        
        .legend {
            display: flex;
            gap: 20px;
            align-items: center;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 500;
        }
        
        .legend-covered { 
            background-color: #e6ffed; 
            border: 1px solid #28a745;
        }
        .legend-uncovered { 
            background-color: #ffebe9; 
            border: 1px solid #d73a49;
        }
        
        .code-container {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 14px;
            line-height: 1.45;
            max-height: 600px;
            overflow-y: auto;
            border-bottom: 1px solid #e1e4e8;
        }
        
        .line {
            display: flex;
            border-bottom: 1px solid #f6f8fa;
            min-height: 20px;
        }
        
        .line:last-child {
            border-bottom: none;
        }
        
        .line-number {
            background-color: #f6f8fa;
            color: #656d76;
            padding: 0 12px;
            text-align: right;
            min-width: 60px;
            user-select: none;
            border-right: 1px solid #e1e4e8;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }
        
        .line-content {
            padding: 0 16px;
            flex: 1;
            white-space: pre;
            overflow-x: auto;
        }
        
        .line-covered {
            background-color: #e6ffed;
        }
        
        .line-uncovered {
            background-color: #ffebe9;
        }
        
        .line-covered .line-number {
            background-color: #28a745;
            color: white;
        }
        
        .line-uncovered .line-number {
            background-color: #d73a49;
            color: white;
        }
        
        .line-gap {
            display: flex;
            border-bottom: 1px solid #f6f8fa;
            min-height: 20px;
            background-color: #f8f9fa;
        }
        
        .line-gap .line-number {
            background-color: #e9ecef;
            color: #6c757d;
            padding: 0 12px;
            text-align: center;
            min-width: 60px;
            user-select: none;
            border-right: 1px solid #e1e4e8;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-style: italic;
        }
        
        .line-gap .line-content {
            padding: 0 16px;
            flex: 1;
            font-style: italic;
            color: #6c757d;
            display: flex;
            align-items: center;
        }
        
        .no-changes {
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-style: italic;
        }
        
        .coverage-bar {
            width: 100px;
            height: 20px;
            background-color: #e1e4e8;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
            display: inline-block;
            margin-left: 10px;
        }
        
        .coverage-fill {
            height: 100%;
            border-radius: 10px;
            transition: width 0.3s ease;
        }
        
        .coverage-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 0.7em;
            font-weight: bold;
            color: #24292f;
            text-shadow: 0 0 3px rgba(255, 255, 255, 0.8);
        }
        
        .status-icon {
            font-size: 1.2em;
        }
        
        .footer {
            padding: 20px 30px;
            text-align: center;
            color: #586069;
            font-size: 0.9em;
            background: #f6f8fa;
        }
        
        .scroll-top {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #0366d6;
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 1.2em;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
            display: none;
        }
        
        .scroll-top:hover {
            background: #0256cc;
            transform: translateY(-2px);
        }
        
        .scroll-top.visible {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>
                📊 PR Diff Coverage Report
            </h1>
            <div class="subtitle">
                Coverage analysis for changed lines only • Generated on ${new Date(timestamp).toLocaleString()}
                ${prData ? `<br>PR #${prData.number}: ${prData.title}` : ''}
            </div>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>${coverage.toFixed(1)}%</h3>
                <p>PR Diff Coverage</p>
                <div class="coverage-badge ${this.getCoverageBadgeClass(coverage, minimumCoverage)}">
                    ${this.getCoverageIcon(coverage, minimumCoverage)} ${coverage >= minimumCoverage ? 'PASS' : 'FAIL'}
                </div>
                <div style="font-size: 0.8em; color: #586069; margin-top: 8px;">
                    Changed lines only
                </div>
            </div>
            
            <div class="summary-card">
                <h3>${coveredLines}</h3>
                <p>Changed Lines Covered</p>
                <div style="font-size: 0.8em; color: #586069; margin-top: 8px;">
                    Lines with test coverage
                </div>
            </div>
            
            <div class="summary-card">
                <h3>${totalLines}</h3>
                <p>Total Changed Lines</p>
                <div style="font-size: 0.8em; color: #586069; margin-top: 8px;">
                    Lines modified in this PR
                </div>
            </div>
            
            <div class="summary-card">
                <h3>${Object.keys(fileResults).length}</h3>
                <p>Files Modified</p>
                <div style="font-size: 0.8em; color: #586069; margin-top: 8px;">
                    Files with changes
                </div>
            </div>
        </div>

        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 30px; color: #495057;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 1.2em;">ℹ️</span>
                <strong style="font-size: 1.1em;">About This Report</strong>
            </div>
            <p style="margin: 0; line-height: 1.5;">
                This report shows <strong>test coverage for changed lines that have coverage data</strong>, not overall project coverage. 
                It analyzes which executable lines modified in this PR are covered by tests. Lines highlighted in 
                <span style="background: #e6ffed; padding: 2px 4px; border-radius: 3px;">green</span> are covered by tests, 
                while lines highlighted in <span style="background: #ffebe9; padding: 2px 4px; border-radius: 3px;">red</span> are not covered.
                Changed lines without coverage data (comments, imports, etc.) appear without highlighting.
            </p>
        </div>

        ${Object.keys(fileResults).length > 0 ? `
        ${fileSectionsHtml}
        ` : `
        <div style="text-align: center; padding: 60px 20px; color: #586069;">
            <h3>🎉 No files with changed lines found</h3>
            <p>Either no files were modified, or the modifications don't include executable code.</p>
        </div>
        `}

        <div class="footer">
            <p>Generated by Jest PR Diff Code Coverage • ${timestamp}</p>
            <p style="font-size: 0.85em; margin-top: 5px; opacity: 0.8;">
                This report analyzes test coverage for changed lines only, not overall project coverage
            </p>
        </div>
    </div>

    <button class="scroll-top" onclick="scrollToTop()">↑</button>

    <script>
        function toggleFile(fileId) {
            const fileHeader = document.querySelector('.file-header[data-file="' + fileId + '"]');
            const fileContent = document.querySelector('.file-content[data-file="' + fileId + '"]');
            const expandIcon = fileHeader.querySelector('.expand-icon');
            
            const isExpanded = fileContent.classList.contains('expanded');
            
            if (isExpanded) {
                fileContent.classList.remove('expanded');
                fileHeader.classList.remove('expanded');
                expandIcon.classList.remove('expanded');
            } else {
                fileContent.classList.add('expanded');
                fileHeader.classList.add('expanded');
                expandIcon.classList.add('expanded');
                
                // Scroll to the file section
                fileHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        
        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Show/hide scroll to top button
        window.addEventListener('scroll', function() {
            const scrollTop = document.querySelector('.scroll-top');
            if (window.pageYOffset > 300) {
                scrollTop.classList.add('visible');
            } else {
                scrollTop.classList.remove('visible');
            }
        });
        
        // Close other files when opening a new one (optional)
        function toggleFileExclusive(fileId) {
            // Close all other files
            document.querySelectorAll('.file-content.expanded').forEach(content => {
                if (content.getAttribute('data-file') !== fileId) {
                    const otherFileId = content.getAttribute('data-file');
                    toggleFile(otherFileId);
                }
            });
            
            // Then toggle this file
            toggleFile(fileId);
        }
    </script>
</body>
</html>`;
  }

  /**
   * Get lines to display with context around changed lines
   */
  getLinesToDisplay(changedLines, totalLines, contextLines = 6) {
    const linesToShow = new Set();
    
    // Add all changed lines
    changedLines.forEach(lineNum => {
      linesToShow.add(lineNum);
    });
    
    // Add context lines around changed lines
    changedLines.forEach(lineNum => {
      for (let i = Math.max(1, lineNum - contextLines); i <= Math.min(totalLines, lineNum + contextLines); i++) {
        linesToShow.add(i);
      }
    });
    
    // Convert to sorted array for easier processing
    return Array.from(linesToShow).sort((a, b) => a - b);
  }

  /**
   * Render lines with context, showing gaps where code is omitted
   */
  renderLinesWithContext(lines, linesToDisplay, changedLines, coverageMap) {
    if (linesToDisplay.length === 0) {
      return '<div class="no-changes">No lines to display</div>';
    }

    let result = '';
    let previousLine = 0;

    for (let i = 0; i < linesToDisplay.length; i++) {
      const lineNumber = linesToDisplay[i];
      const line = lines[lineNumber - 1]; // lines array is 0-indexed
      
      // Show gap indicator if there's a jump in line numbers
      if (lineNumber > previousLine + 1) {
        const skippedLines = lineNumber - previousLine - 1;
        result += `
          <div class="line-gap">
            <div class="line-number gap">⋯</div>
            <div class="line-content gap">⋯ ${skippedLines} lines omitted ⋯</div>
          </div>
        `;
      }
      
      const isChanged = changedLines.includes(lineNumber);
      const isCovered = coverageMap.get(lineNumber);
      
      let lineClass = '';
      // Only highlight changed lines that have coverage data
      if (isChanged && isCovered === true) {
        lineClass = 'line-covered';
      } else if (isChanged && isCovered === false) {
        lineClass = 'line-uncovered';
      }
      // Changed lines without coverage data will have no special styling (appear as context)
      
      result += `
        <div class="line ${lineClass}">
          <div class="line-number">${lineNumber}</div>
          <div class="line-content">${this.escapeHtml(line || '')}</div>
        </div>
      `;
      
      previousLine = lineNumber;
    }

    return result;
  }

  /**
   * Generate individual expandable file section
   */
  generateFileSection(filePath, lines, changedLinesSet, result, fileCoverageData, fileId, minimumCoverage) {
    const changedLines = Array.from(changedLinesSet || []);
    const linesToDisplay = this.getLinesToDisplay(changedLines, lines.length);
    
    // Create a map of line numbers to coverage status
    const coverageMap = new Map();
    if (fileCoverageData && fileCoverageData.lines && fileCoverageData.lines.details) {
      fileCoverageData.lines.details.forEach(lineInfo => {
        coverageMap.set(lineInfo.line, lineInfo.hit > 0);
      });
    }
    
    return `
        <div class="file-section" id="${fileId}">
            <div class="file-header" data-file="${fileId}" onclick="toggleFile('${fileId}')">
                <div class="file-title">
                    <span class="status-icon">${result.coverage >= minimumCoverage ? '✅' : '❌'}</span>
                    <span class="file-path">${filePath}</span>
                </div>
                <div class="file-stats">
                    <div class="coverage-bar">
                        <div class="coverage-fill ${this.getCoverageBadgeClass(result.coverage, minimumCoverage)}" style="width: ${result.coverage}%"></div>
                        <div class="coverage-text">${result.coverage >= minimumCoverage ? 'PASS' : 'FAIL'}</div>
                    </div>
                    <span>Changed: ${result.totalLines}</span>
                    <span>Covered: ${result.coveredLines}</span>
                    <span style="font-size: 0.8em; opacity: 0.7;">Diff Coverage</span>
                    <span class="expand-icon">▼</span>
                </div>
            </div>
            
            <div class="file-content" data-file="${fileId}">
                <div class="code-header">
                    <div class="legend">
                        <div class="legend-item legend-covered">
                            <span>✅</span>
                            <span>Covered</span>
                        </div>
                        <div class="legend-item legend-uncovered">
                            <span>❌</span>
                            <span>Uncovered</span>
                        </div>
                    </div>
                </div>
                
                <div class="code-container">
                    ${this.renderLinesWithContext(lines, linesToDisplay, changedLines, coverageMap)}
                </div>
            </div>
        </div>`;
  }


  /**
   * Generate individual file coverage report
   */
  async generateFileReport(filePath, result, changedLinesSet, coverageData) {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');
      
      // Find coverage data for this specific file
      const fileCoverageData = this.findFileCoverageData(filePath, coverageData);
      
      // Create file-specific report directory
      const fileDir = path.join(this.reportDir, 'files');
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      const fileName = filePath.replace(/[/\\]/g, '_').replace(/\./g, '_') + '.html';
      const fileReportPath = path.join(fileDir, fileName);
      
      const html = this.generateFileHtml(filePath, lines, changedLinesSet, result, fileCoverageData);
      fs.writeFileSync(fileReportPath, html);
      
      return fileReportPath;
    } catch (error) {
      console.warn(`Could not generate file report for ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Find coverage data for a specific file
   */
  findFileCoverageData(filePath, coverageData) {
    if (!coverageData) return null;
    
    const normalizedPath = filePath.replace(/^\.\//, '');
    return coverageData.find(file => {
      const fileNormalizedPath = file.file.replace(/^\.\//, '');
      return fileNormalizedPath === normalizedPath;
    });
  }

  /**
   * Generate HTML for individual file coverage
   */
  generateFileHtml(filePath, lines, changedLinesSet, result, fileCoverageData) {
    const changedLines = Array.from(changedLinesSet || []);
    const linesToDisplay = this.getLinesToDisplay(changedLines, lines.length);
    
    // Create a map of line numbers to coverage status
    const coverageMap = new Map();
    if (fileCoverageData && fileCoverageData.lines && fileCoverageData.lines.details) {
      fileCoverageData.lines.details.forEach(lineInfo => {
        coverageMap.set(lineInfo.line, lineInfo.hit > 0);
      });
    }
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage: ${filePath}</title>
    <style>
        body {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 14px;
            line-height: 1.45;
            margin: 0;
            padding: 20px;
            background-color: #f6f8fa;
        }
        
        .header {
            background: white;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #e1e4e8;
        }
        
        .file-path {
            font-weight: 600;
            color: #24292f;
            font-size: 16px;
            margin-bottom: 10px;
        }
        
        .file-stats {
            color: #586069;
            font-size: 14px;
        }
        
        .code-container {
            background: white;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            overflow: auto;
        }
        
        .line {
            display: flex;
            border-bottom: 1px solid #f6f8fa;
        }
        
        .line:last-child {
            border-bottom: none;
        }
        
        .line-number {
            background-color: #f6f8fa;
            color: #656d76;
            padding: 0 16px;
            text-align: right;
            min-width: 50px;
            user-select: none;
            border-right: 1px solid #e1e4e8;
        }
        
        .line-content {
            padding: 0 16px;
            flex: 1;
            white-space: pre;
            overflow-x: auto;
        }
        
        .line-covered {
            background-color: #e6ffed;
        }
        
        .line-uncovered {
            background-color: #ffebe9;
        }
        
        .line-covered .line-number {
            background-color: #28a745;
            color: white;
        }
        
        .line-uncovered .line-number {
            background-color: #d73a49;
            color: white;
        }
        
        .line-gap {
            display: flex;
            border-bottom: 1px solid #f6f8fa;
            min-height: 20px;
            background-color: #f8f9fa;
        }
        
        .line-gap .line-number {
            background-color: #e9ecef;
            color: #6c757d;
            padding: 0 12px;
            text-align: center;
            min-width: 60px;
            user-select: none;
            border-right: 1px solid #e1e4e8;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-style: italic;
        }
        
        .line-gap .line-content {
            padding: 0 16px;
            flex: 1;
            font-style: italic;
            color: #6c757d;
            display: flex;
            align-items: center;
        }
        
        .no-changes {
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-style: italic;
        }
        
        .legend {
            margin-bottom: 20px;
            padding: 15px;
            background: white;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
        }
        
        .legend-item {
            display: inline-block;
            margin-right: 20px;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
        }
        
        .legend-covered { background-color: #e6ffed; }
        .legend-uncovered { background-color: #ffebe9; }
    </style>
</head>
<body>
    <div class="header">
        <div class="file-path">${filePath}</div>
        <div class="file-stats">
            Coverage: ${result.coverage.toFixed(1)}% • 
            Changed Lines: ${result.totalLines} • 
            Covered Lines: ${result.coveredLines}
        </div>
    </div>
    
    <div class="legend">
        <span class="legend-item legend-covered">✅ Covered</span>
        <span class="legend-item legend-uncovered">❌ Uncovered</span>
    </div>
    
    <div class="code-container">
        ${this.renderLinesWithContext(lines, linesToDisplay, changedLines, coverageMap)}
    </div>
</body>
</html>`;
  }

  /**
   * Get coverage badge CSS class based on minimum threshold
   */
  getCoverageBadgeClass(coverage, minimumCoverage) {
    return coverage >= minimumCoverage ? 'coverage-pass' : 'coverage-fail';
  }

  /**
   * Get coverage icon based on minimum threshold
   */
  getCoverageIcon(coverage, minimumCoverage) {
    return coverage >= minimumCoverage ? '✅' : '❌';
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Clean up generated reports
   */
  cleanup() {
    if (fs.existsSync(this.reportDir)) {
      fs.rmSync(this.reportDir, { recursive: true, force: true });
    }
  }
}

module.exports = HtmlReportGenerator;
