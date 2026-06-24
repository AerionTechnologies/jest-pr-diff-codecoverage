const fs = require('fs');
const path = require('path');
const HtmlReportGenerator = require('../html-report-generator');

// Mock fs module
jest.mock('fs');

describe('HtmlReportGenerator', () => {
  let generator;
  
  beforeEach(() => {
    generator = new HtmlReportGenerator();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any real files created during tests
    if (fs.existsSync && typeof fs.existsSync === 'function') {
      try {
        if (fs.existsSync(generator.reportDir)) {
          fs.rmSync(generator.reportDir, { recursive: true, force: true });
        }
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('generateReport', () => {
    it('should generate main HTML report with coverage data', async () => {
      const mockCoverageResults = {
        totalLines: 10,
        coveredLines: 8,
        coverage: 80.0,
        fileResults: {
          'src/test.js': {
            totalLines: 5,
            coveredLines: 4,
            coverage: 80.0
          }
        }
      };

      const mockChangedLines = {
        'src/test.js': new Set([1, 2, 3, 4, 5])
      };

      const mockPrData = {
        number: 123,
        title: 'Test PR'
      };

      // Mock fs methods
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('console.log("test");');

      const result = await generator.generateReport(mockCoverageResults, mockChangedLines, mockPrData);

      expect(result).toHaveProperty('mainReport');
      expect(result).toHaveProperty('fileReports');
      expect(result).toHaveProperty('reportDir');
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should copy coverage file into report directory when provided', async () => {
      const mockCoverageResults = {
        totalLines: 10,
        coveredLines: 8,
        coverage: 80.0,
        fileResults: {}
      };

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === 'coverage/lcov.info') {
          return true;
        }
        return false;
      });
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});

      const result = await generator.generateReport(
        mockCoverageResults,
        {},
        { number: 123, title: 'Test PR' },
        null,
        80,
        'coverage/lcov.info'
      );

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        'coverage/lcov.info',
        path.join(generator.reportDir, 'lcov.info')
      );
      expect(result.coverageFile).toBe(path.join(generator.reportDir, 'lcov.info'));
    });
  });

  describe('generateEnhancedMainReport', () => {
    it('should create HTML with coverage statistics', () => {
      const mockResults = {
        totalLines: 10,
        coveredLines: 8,
        coverage: 80.0,
        fileResults: {
          'src/test.js': {
            totalLines: 5,
            coveredLines: 4,
            coverage: 80.0
          }
        }
      };

      const mockPrData = {
        number: 123,
        title: 'Test PR'
      };

      const mockFileSectionsHtml = '<div>Mock file sections</div>';

      const html = generator.generateEnhancedMainReport(mockResults, mockPrData, mockFileSectionsHtml);

      expect(html).toContain('80.0%');
      expect(html).toContain('PR Diff Coverage Report');
      expect(html).toContain('PR #123: Test PR');
      expect(html).toContain('Mock file sections');
    });

    it('should handle empty file results', () => {
      const mockResults = {
        totalLines: 0,
        coveredLines: 0,
        coverage: 100.0,
        fileResults: {},
        missingFromCoverage: []
      };

      const mockFileSectionsHtml = '';

      const html = generator.generateEnhancedMainReport(mockResults, null, mockFileSectionsHtml);

      expect(html).toContain('No trackable changed lines found');
      expect(html).toContain('100.0%');
    });

    it('should show files missing from the coverage report', () => {
      const mockResults = {
        totalLines: 0,
        coveredLines: 0,
        coverage: 100.0,
        fileResults: {},
        missingFromCoverage: [
          { file: 'app/navigators/app-navigator.tsx', changedLines: 11 },
          { file: 'CHANGELOG.md', changedLines: 2 }
        ]
      };

      const html = generator.generateEnhancedMainReport(mockResults, null, '');

      expect(html).toContain('Files Not in Coverage Report');
      expect(html).toContain('app/navigators/app-navigator.tsx');
      expect(html).toContain('CHANGELOG.md');
      expect(html).toContain('Not in Coverage File');
      expect(html).not.toContain('No trackable changed lines found');
    });
  });

  describe('generateMissingFromCoverageSection', () => {
    it('should return empty string when there are no missing files', () => {
      expect(generator.generateMissingFromCoverageSection([])).toBe('');
      expect(generator.generateMissingFromCoverageSection(null)).toBe('');
    });

    it('should render a table of missing files', () => {
      const html = generator.generateMissingFromCoverageSection([
        { file: 'app/navigators/app-navigator.tsx', changedLines: 11 }
      ]);

      expect(html).toContain('Files Not in Coverage Report');
      expect(html).toContain('app/navigators/app-navigator.tsx');
      expect(html).toContain('11');
    });
  });

  describe('getCoverageBadgeClass', () => {
    it('should return pass or fail based on minimum coverage threshold', () => {
      expect(generator.getCoverageBadgeClass(85, 80)).toBe('coverage-pass');
      expect(generator.getCoverageBadgeClass(80, 80)).toBe('coverage-pass');
      expect(generator.getCoverageBadgeClass(65, 80)).toBe('coverage-fail');
      expect(generator.getCoverageBadgeClass(0, 80)).toBe('coverage-fail');
    });
  });

  describe('getCoverageIcon', () => {
    it('should return pass or fail icon based on minimum coverage threshold', () => {
      expect(generator.getCoverageIcon(85, 80)).toBe('✅');
      expect(generator.getCoverageIcon(65, 80)).toBe('❌');
      expect(generator.getCoverageIcon(0, 80)).toBe('❌');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("test");</script>';
      const expected = '&lt;script&gt;alert(&quot;test&quot;);&lt;/script&gt;';
      expect(generator.escapeHtml(input)).toBe(expected);
    });

    it('should handle strings without special characters', () => {
      const input = 'normal text';
      expect(generator.escapeHtml(input)).toBe('normal text');
    });
  });

  describe('cleanup', () => {
    it('should remove report directory', () => {
      fs.existsSync.mockReturnValue(true);
      fs.rmSync.mockImplementation(() => {});

      generator.cleanup();

      expect(fs.rmSync).toHaveBeenCalledWith(
        generator.reportDir,
        { recursive: true, force: true }
      );
    });

    it('should not fail if directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => generator.cleanup()).not.toThrow();
    });
  });
});
