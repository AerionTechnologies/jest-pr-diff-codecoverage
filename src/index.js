const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const CoverageParser = require('./coverage-parser');
const HtmlReportGenerator = require('./html-report-generator');

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
   * Upload HTML coverage report as GitHub Actions artifact
   */
  async uploadHtmlReportArtifact(reportData) {
    try {
      const artifactName = `coverage-report-pr-${this.context.payload.pull_request.number}`;
      
      // Use GitHub's upload-artifact action via REST API
      core.info(`Uploading HTML coverage report as artifact: ${artifactName}`);
      
      // Set output for the artifact path so it can be used by upload-artifact action
      core.setOutput('html-report-path', reportData.reportDir);
      core.setOutput('html-report-artifact-name', artifactName);
      
      // Generate URL to the workflow run's artifacts page
      const runId = this.context.runId;
      const repo = this.context.repo;
      const artifactsUrl = `https://github.com/${repo.owner}/${repo.repo}/actions/runs/${runId}`;
      
      return {
        artifactName,
        reportPath: reportData.reportDir,
        mainReportFile: reportData.mainReport,
        downloadUrl: artifactsUrl
      };
    } catch (error) {
      core.warning(`Failed to prepare HTML report artifact: ${error.message}`);
      return null;
    }
  }

  /**
   * Find existing coverage comment by this action
   */
  async findExistingCoverageComment() {
    try {
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: this.context.payload.pull_request.number
      });

      // Look for comments that contain our coverage report header
      const coverageComment = comments.find(comment => 
        comment.body.includes('## 📊 Code Coverage Report for Changed Lines')
      );

      return coverageComment || null;
    } catch (error) {
      core.warning(`Failed to find existing coverage comment: ${error.message}`);
      return null;
    }
  }

  /**
   * Create PR comment with coverage results
   */
  async createPrComment(results, threshold, meetsThreshold, htmlReportInfo = null, updateExisting = false) {
    const { totalLines, coveredLines, coverage, fileResults } = results;
    
    let comment = `## 📊 Code Coverage Report for Changed Lines\n\n`;
    
    comment += `**Overall Coverage:** ${coverage.toFixed(2)}% (${coveredLines}/${totalLines} lines covered)\n`;
    comment += `**Threshold:** ${threshold}%\n`;
    comment += `**Status:** ${meetsThreshold ? '✅ Passed' : '❌ Failed'}\n\n`;

    // Add HTML report link if available
    if (htmlReportInfo) {
      comment += `📋 **[View Detailed HTML Coverage Report](${htmlReportInfo.downloadUrl || '#'})**\n`;
      comment += `*Click the link above to view the workflow run and download the \`${htmlReportInfo.artifactName}\` artifact for detailed line-by-line coverage analysis.*\n\n`;
    }

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

    if (htmlReportInfo) {
      comment += `\n\n---\n📁 **HTML Report Artifact:** \`${htmlReportInfo.artifactName}\`\n`;
      comment += `The detailed HTML coverage report is available as a downloadable artifact in the [workflow run](${htmlReportInfo.downloadUrl}). `;
      comment += `Once the workflow completes, you can download the artifact to view comprehensive coverage details.`;
    }

    try {
      if (updateExisting) {
        // Try to find and update existing comment
        const existingComment = await this.findExistingCoverageComment();
        
        if (existingComment) {
          await this.octokit.rest.issues.updateComment({
            owner: this.context.repo.owner,
            repo: this.context.repo.repo,
            comment_id: existingComment.id,
            body: comment
          });
          core.info(`Updated existing PR comment (ID: ${existingComment.id})`);
          return;
        } else {
          core.info('No existing coverage comment found, creating new one');
        }
      }

      // Create new comment (either when updateExisting is false or no existing comment found)
      await this.octokit.rest.issues.createComment({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: this.context.payload.pull_request.number,
        body: comment
      });
      core.info('Created new PR comment');
    } catch (error) {
      core.warning(`Failed to ${updateExisting ? 'update' : 'create'} PR comment: ${error.message}`);
    }
  }
}

async function run() {
  try {
    const coverageFilePath = core.getInput('coverage-file');
    const minimumCoverage = parseFloat(core.getInput('minimum-coverage'));
    const failOnBelowThreshold = core.getInput('fail-on-coverage-below-threshold') === 'true';
    const commentOnPr = core.getInput('comment-on-pr') === 'true';
    const generateHtmlReport = core.getInput('generate-html-report') === 'true';
    const updateComment = core.getInput('update-comment') === 'true';

    core.info(`Coverage file: ${coverageFilePath}`);
    core.info(`Minimum coverage: ${minimumCoverage}%`);
    core.info(`Generate HTML report: ${generateHtmlReport}`);
    core.info(`Update comment: ${updateComment}`);

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

    // Generate HTML report if enabled
    let htmlReportInfo = null;
    if (generateHtmlReport) {
      try {
        core.info('Generating HTML coverage report...');
        const htmlGenerator = new HtmlReportGenerator();
        
        const prData = {
          number: github.context.payload.pull_request.number,
          title: github.context.payload.pull_request.title
        };
        
        const reportData = await htmlGenerator.generateReport(results, changedLines, prData, coverageData, minimumCoverage);
        htmlReportInfo = await analyzer.uploadHtmlReportArtifact(reportData);
        
        core.info(`HTML report generated: ${reportData.mainReport}`);
      } catch (error) {
        core.warning(`Failed to generate HTML report: ${error.message}`);
      }
    }

    // Create PR comment if enabled
    if (commentOnPr) {
      core.info(updateComment ? 'Creating/updating PR comment...' : 'Creating PR comment...');
      await analyzer.createPrComment(results, minimumCoverage, meetsThreshold, htmlReportInfo, updateComment);
    }

    // Fail if coverage is below threshold
    if (!meetsThreshold && failOnBelowThreshold) {
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
