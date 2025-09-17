const fs = require('fs');
const lcovParse = require('lcov-parse');

/**
 * Utility class for parsing different coverage file formats
 */
class CoverageParser {
  /**
   * Parse LCOV format coverage file
   */
  static async parseLcov(filePath) {
    return new Promise((resolve, reject) => {
      lcovParse(filePath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Parse Jest JSON coverage format
   */
  static parseJestJson(filePath) {
    const coverageData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = [];

    for (const [file, data] of Object.entries(coverageData)) {
      if (file === 'total') continue;

      const lineData = {};
      
      // Convert Jest statement coverage to line coverage
      if (data.s && data.statementMap) {
        for (const [statementId, statement] of Object.entries(data.statementMap)) {
          const startLine = statement.start.line;
          const endLine = statement.end.line;
          const hits = data.s[statementId] || 0;
          
          // Mark all lines in the statement
          for (let line = startLine; line <= endLine; line++) {
            if (!lineData[line] || lineData[line] < hits) {
              lineData[line] = hits;
            }
          }
        }
      }

      // Also process branch coverage if available
      if (data.b && data.branchMap) {
        for (const [branchId, branch] of Object.entries(data.branchMap)) {
          const line = branch.line;
          const branchHits = data.b[branchId];
          const hasHits = branchHits && branchHits.some(h => h > 0);
          
          if (hasHits && (!lineData[line] || lineData[line] === 0)) {
            lineData[line] = 1;
          }
        }
      }

      result.push({
        file: file.replace(process.cwd(), '').replace(/^\//, ''),
        lines: {
          details: Object.keys(lineData).map(line => ({
            line: parseInt(line),
            hit: lineData[line]
          }))
        }
      });
    }

    return result;
  }

  /**
   * Auto-detect and parse coverage file
   */
  static async parse(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Coverage file not found: ${filePath}`);
    }

    if (filePath.endsWith('.info') || filePath.includes('lcov')) {
      return await this.parseLcov(filePath);
    } else if (filePath.endsWith('.json')) {
      return this.parseJestJson(filePath);
    } else {
      throw new Error('Unsupported coverage file format. Please use LCOV (.info) or Jest JSON format.');
    }
  }
}

module.exports = CoverageParser;
