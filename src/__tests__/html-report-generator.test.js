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
  });

  describe('generateMainReport', () => {
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

      const html = generator.generateMainReport(mockResults, mockPrData);

      expect(html).toContain('80.0%');
      expect(html).toContain('PR Code Coverage Report');
      expect(html).toContain('src/test.js');
      expect(html).toContain('PR #123: Test PR');
    });

    it('should handle empty file results', () => {
      const mockResults = {
        totalLines: 0,
        coveredLines: 0,
        coverage: 100.0,
        fileResults: {}
      };

      const html = generator.generateMainReport(mockResults, null);

      expect(html).toContain('No files with changed lines found');
      expect(html).toContain('100.0%');
    });
  });

  describe('getCoverageBadgeClass', () => {
    it('should return correct CSS class for high coverage', () => {
      expect(generator.getCoverageBadgeClass(85)).toBe('coverage-high');
      expect(generator.getCoverageBadgeClass(80)).toBe('coverage-high');
    });

    it('should return correct CSS class for medium coverage', () => {
      expect(generator.getCoverageBadgeClass(65)).toBe('coverage-medium');
      expect(generator.getCoverageBadgeClass(50)).toBe('coverage-medium');
    });

    it('should return correct CSS class for low coverage', () => {
      expect(generator.getCoverageBadgeClass(30)).toBe('coverage-low');
      expect(generator.getCoverageBadgeClass(0)).toBe('coverage-low');
    });
  });

  describe('getCoverageIcon', () => {
    it('should return correct icon for different coverage levels', () => {
      expect(generator.getCoverageIcon(85)).toBe('✅');
      expect(generator.getCoverageIcon(65)).toBe('⚠️');
      expect(generator.getCoverageIcon(30)).toBe('❌');
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
