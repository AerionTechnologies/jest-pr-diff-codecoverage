const CoverageParser = require('../coverage-parser');
const fs = require('fs');
const path = require('path');

// Mock fs for testing
jest.mock('fs');

describe('CoverageParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseJestJson', () => {
    it('should parse Jest JSON coverage format correctly', () => {
      const mockCoverageData = {
        'src/example.js': {
          s: { '0': 1, '1': 0, '2': 1 },
          statementMap: {
            '0': { start: { line: 1 }, end: { line: 1 } },
            '1': { start: { line: 2 }, end: { line: 2 } },
            '2': { start: { line: 3 }, end: { line: 3 } }
          }
        },
        total: {
          // total stats - should be ignored
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageData));
      fs.existsSync.mockReturnValue(true);

      const result = CoverageParser.parseJestJson('coverage.json');

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('src/example.js');
      expect(result[0].lines.details).toEqual([
        { line: 1, hit: 1 },
        { line: 2, hit: 0 },
        { line: 3, hit: 1 }
      ]);
    });

    it('should handle files with branch coverage', () => {
      const mockCoverageData = {
        'src/example.js': {
          s: { '0': 1 },
          statementMap: {
            '0': { start: { line: 1 }, end: { line: 1 } }
          },
          b: { '0': [1, 0] },
          branchMap: {
            '0': { line: 2 }
          }
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(mockCoverageData));
      fs.existsSync.mockReturnValue(true);

      const result = CoverageParser.parseJestJson('coverage.json');

      expect(result[0].lines.details).toEqual([
        { line: 1, hit: 1 },
        { line: 2, hit: 1 }
      ]);
    });
  });

  describe('parse', () => {
    it('should throw error for non-existent file', async () => {
      fs.existsSync.mockReturnValue(false);

      await expect(CoverageParser.parse('nonexistent.json')).rejects.toThrow(
        'Coverage file not found: nonexistent.json'
      );
    });

    it('should throw error for unsupported format', async () => {
      fs.existsSync.mockReturnValue(true);

      await expect(CoverageParser.parse('coverage.xml')).rejects.toThrow(
        'Unsupported coverage file format'
      );
    });

    it('should detect JSON format correctly', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{}');

      const spy = jest.spyOn(CoverageParser, 'parseJestJson');
      spy.mockReturnValue([]);

      await CoverageParser.parse('coverage.json');

      expect(spy).toHaveBeenCalledWith('coverage.json');
    });
  });
});
