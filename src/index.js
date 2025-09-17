const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const CoverageParser = require('./coverage-parser');

class CoverageAnalyzer {
  constructor() {
    this.token = core.getInput('github-token');
    this.octokit = github.getOctokit(this.token);
    this.context = github.context;
  }


  /**
   * Get PR files and their changed lines
   */
  async getPrChangedLines() {
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      pull_number: this.context.payload.pull_request.number
    });

    const changedLines = {};

    for (const file of files) {
      if (file.status === 'removed') continue;
      
      const filename = file.filename;
      changedLines[filename] = new Set();

      if (file.patch) {
        const lines = file.patch.split('\n');
        let currentLine = 0;

        for (const line of lines) {
          if (line.startsWith('@@')) {
            // Parse hunk header: @@ -start,count +start,count @@
            const match = line.match(/\+(\d+)/);
            if (match) {
              currentLine = parseInt(match[1]);
            }
          } else if (line.startsWith('+') && !line.startsWith('+++')) {
            // This is an added line
            changedLines[filename].add(currentLine);
            currentLine++;
          } else if (!line.startsWith('-') && !line.startsWith('\\')) {
            // This is a context line (unchanged)
            currentLine++;
          }
        }
      }
    }

    return changedLines;
  }

  /**
   * Calculate coverage for changed lines
   */
  calculateChangedLinesCoverage(coverageData, changedLines) {
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
   * Create PR comment with coverage results
   */
  async createPrComment(results, threshold, meetsThreshold) {
    const { totalLines, coveredLines, coverage, fileResults } = results;

    let comment = `## 📊 Code Coverage Report for Changed Lines\n\n`;
    
    comment += `**Overall Coverage:** ${coverage.toFixed(2)}% (${coveredLines}/${totalLines} lines covered)\n`;
    comment += `**Threshold:** ${threshold}%\n`;
    comment += `**Status:** ${meetsThreshold ? '✅ Passed' : '❌ Failed'}\n\n`;

    if (Object.keys(fileResults).length > 0) {
      comment += `### File Coverage Details\n\n`;
      comment += `| File | Coverage | Lines Changed | Lines Covered |\n`;
      comment += `|------|----------|---------------|---------------|\n`;

      for (const [file, result] of Object.entries(fileResults)) {
        const icon = result.coverage >= threshold ? '✅' : '❌';
        comment += `| ${file} | ${icon} ${result.coverage.toFixed(2)}% | ${result.totalLines} | ${result.coveredLines} |\n`;
      }
    }

    if (!meetsThreshold) {
      comment += `\n⚠️ **The coverage of changed lines (${coverage.toFixed(2)}%) is below the required threshold (${threshold}%).**\n`;
      comment += `Please add tests to cover the new/modified code.`;
    }

    try {
      await this.octokit.rest.issues.createComment({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: this.context.payload.pull_request.number,
        body: comment
      });
    } catch (error) {
      core.warning(`Failed to create PR comment: ${error.message}`);
    }
  }
}

async function run() {
  try {
    const coverageFilePath = core.getInput('coverage-file');
    const minimumCoverage = parseFloat(core.getInput('minimum-coverage'));
    const failOnDecrease = core.getInput('fail-on-coverage-decrease') === 'true';
    const commentOnPr = core.getInput('comment-on-pr') === 'true';

    core.info(`Coverage file: ${coverageFilePath}`);
    core.info(`Minimum coverage: ${minimumCoverage}%`);

    // Check if we're in a PR context
    if (!github.context.payload.pull_request) {
      core.setFailed('This action can only be run on pull requests');
      return;
    }

    // Check if coverage file exists
    if (!fs.existsSync(coverageFilePath)) {
      core.setFailed(`Coverage file not found: ${coverageFilePath}`);
      return;
    }

    const analyzer = new CoverageAnalyzer();

    // Parse coverage data
    core.info('Parsing coverage data...');
    const coverageData = await CoverageParser.parse(coverageFilePath);

    // Get changed lines in PR
    core.info('Getting PR changed lines...');
    const changedLines = await analyzer.getPrChangedLines();

    // Calculate coverage for changed lines
    core.info('Calculating coverage for changed lines...');
    const results = analyzer.calculateChangedLinesCoverage(coverageData, changedLines);

    // Set outputs
    core.setOutput('coverage-percentage', results.coverage.toFixed(2));
    core.setOutput('lines-covered', results.coveredLines);
    core.setOutput('total-lines', results.totalLines);
    const meetsThreshold = results.coverage >= minimumCoverage;
    core.setOutput('meets-threshold', meetsThreshold);

    // Log results
    core.info(`Coverage of changed lines: ${results.coverage.toFixed(2)}%`);
    core.info(`Lines covered: ${results.coveredLines}/${results.totalLines}`);
    core.info(`Meets threshold (${minimumCoverage}%): ${meetsThreshold}`);

    // Create PR comment if enabled
    if (commentOnPr) {
      core.info('Creating PR comment...');
      await analyzer.createPrComment(results, minimumCoverage, meetsThreshold);
    }

    // Fail if coverage is below threshold
    if (!meetsThreshold && failOnDecrease) {
      core.setFailed(
        `Code coverage of changed lines (${results.coverage.toFixed(2)}%) is below the required threshold (${minimumCoverage}%)`
      );
    }

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
    core.debug(error.stack);
  }
}

run();
