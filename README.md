# Jest PR Diff Code Coverage Check

A GitHub Action that analyzes Jest code coverage for lines changed in a Pull Request and ensures they meet a minimum coverage threshold.

## Features

- ✅ **Precise Coverage Analysis**: Only analyzes coverage for lines that were actually changed in the PR
- 📊 **Multiple Format Support**: Works with LCOV and Jest JSON coverage formats
- 💬 **PR Comments**: Automatically comments on PRs with detailed coverage reports
- 📋 **HTML Reports**: Generate beautiful, detailed HTML coverage reports for visual analysis
- 🎯 **Configurable Thresholds**: Set your own minimum coverage requirements
- 🚫 **Optional Failure**: Choose whether to fail the action if coverage is below threshold

## Usage

### Basic Setup

Add this action to your GitHub workflow after running your tests with coverage:

```yaml
name: Test Coverage

on:
  pull_request:
    branches: [ main ]

jobs:
  coverage-check:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests with coverage
      run: npm test -- --coverage
    
    - name: Check PR Code Coverage
      uses: AerionTechnologies/jest-pr-diff-codecoverage@v1
      with:
        coverage-file: 'coverage/lcov.info'
        minimum-coverage: '80'
        github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Configuration

```yaml
    - name: Check PR Code Coverage
      uses: AerionTechnologies/jest-pr-diff-codecoverage@v1
      with:
        coverage-file: 'coverage/coverage-final.json'  # Use Jest JSON format
        minimum-coverage: '85'                         # Require 85% coverage
        github-token: ${{ secrets.GITHUB_TOKEN }}
        fail-on-coverage-decrease: 'false'            # Don't fail, just report
        comment-on-pr: 'true'                         # Post detailed comment
        generate-html-report: 'true'                  # Generate HTML report
```

### HTML Coverage Reports

To enable detailed HTML coverage reports with visual line-by-line analysis:

```yaml
    - name: Check PR Code Coverage
      uses: AerionTechnologies/jest-pr-diff-codecoverage@v1
      id: coverage
      with:
        coverage-file: 'coverage/lcov.info'
        minimum-coverage: '80'
        github-token: ${{ secrets.GITHUB_TOKEN }}
        generate-html-report: 'true'
    
    # Upload the HTML report as a downloadable artifact
    - name: Upload Coverage Report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: ${{ steps.coverage.outputs.html-report-artifact-name }}
        path: ${{ steps.coverage.outputs.html-report-path }}
        retention-days: 30
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `coverage-file` | Path to Jest coverage file (LCOV or JSON format) | Yes | `coverage/lcov.info` |
| `minimum-coverage` | Minimum code coverage percentage (0-100) | Yes | `80` |
| `github-token` | GitHub token for API access | Yes | `${{ github.token }}` |
| `fail-on-coverage-decrease` | Fail the action if coverage is below threshold | No | `true` |
| `comment-on-pr` | Comment coverage results on the PR | No | `true` |
| `generate-html-report` | Generate detailed HTML coverage report | No | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `coverage-percentage` | Coverage percentage of changed lines |
| `lines-covered` | Number of changed lines covered by tests |
| `total-lines` | Total number of changed lines |
| `meets-threshold` | Whether the coverage meets the minimum threshold |
| `html-report-path` | Path to the generated HTML report directory |
| `html-report-artifact-name` | Name of the uploaded HTML report artifact |

## Coverage File Formats

### LCOV Format
Generate LCOV format with Jest:
```bash
npm test -- --coverage --coverageReporters=lcov
```

This creates `coverage/lcov.info`.

### Jest JSON Format
Generate JSON format with Jest:
```bash
npm test -- --coverage --coverageReporters=json
```

This creates `coverage/coverage-final.json`.

## How It Works

1. **Parse Coverage Data**: Reads your Jest coverage file (LCOV or JSON format)
2. **Get PR Changes**: Uses GitHub API to get the exact lines changed in the PR
3. **Calculate Coverage**: Determines coverage percentage for only the changed lines
4. **Report Results**: Comments on the PR with detailed results and optionally fails the check

## Example Output

The action will post a comment on your PR like this:

```
## 📊 Code Coverage Report for Changed Lines

**Overall Coverage:** 85.71% (6/7 lines covered)
**Threshold:** 80%
**Status:** ✅ Passed

📋 **[View Detailed HTML Coverage Report](#)**
*The HTML report provides line-by-line coverage details for all changed files.*

### File Coverage Details

| File | Coverage | Lines Changed | Lines Covered |
|------|----------|---------------|---------------|
| src/utils.js | ✅ 100.00% | 3 | 3 |
| src/main.js | ✅ 75.00% | 4 | 3 |

---
📁 **HTML Report Artifact:** `coverage-report-pr-123`
You can download the detailed coverage report from the GitHub Actions artifacts once the workflow completes.
```

## HTML Coverage Reports

When `generate-html-report` is enabled, the action creates a beautiful, interactive HTML report that provides:

### 📊 **Main Dashboard**
- Overall coverage statistics with visual indicators
- Coverage breakdown by file with progress bars
- Color-coded status indicators (✅ High, ⚠️ Medium, ❌ Low coverage)
- Professional styling with modern UI components

### 📁 **Individual File Reports** 
- Line-by-line coverage visualization
- Highlighted changed lines in the PR
- Color-coded coverage status:
  - 🔄 **Changed Lines** (highlighted in yellow)
  - ✅ **Covered Lines** (highlighted in green) 
  - ❌ **Uncovered Lines** (highlighted in red)
- Syntax highlighting for better readability

### 🔗 **Easy Access**
- Reports are uploaded as GitHub Actions artifacts
- Direct download links in PR comments
- Accessible to all team members with repository access
- Retained for configurable duration (default: 30 days)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Build the action: `npm run build`
6. Submit a pull request

## Development

### Building

```bash
npm install
npm run build
```

### Testing

```bash
npm test
```

### Local Testing

You can test the action locally by setting environment variables:

```bash
export INPUT_COVERAGE-FILE="coverage/lcov.info"
export INPUT_MINIMUM-COVERAGE="80"
export GITHUB_TOKEN="your-token"
node src/index.js
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Actions

- [Jest Coverage Report](https://github.com/ArtiomTr/jest-coverage-report-action) - General Jest coverage reporting
- [Code Coverage Summary](https://github.com/irongut/CodeCoverageSummary) - .NET coverage reporting

## Support

If you encounter issues or have questions:

1. Check the [Issues](../../issues) page
2. Review the [documentation](#usage)
3. Create a new issue with details about your setup
