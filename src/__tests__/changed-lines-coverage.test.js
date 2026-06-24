const { calculateChangedLinesCoverage } = require('../changed-lines-coverage');

describe('calculateChangedLinesCoverage', () => {
  const coverageData = [
    {
      file: 'app/components/text-field.tsx',
      lines: {
        details: [
          { line: 10, hit: 1 },
          { line: 11, hit: 0 },
          { line: 12, hit: 1 }
        ]
      }
    }
  ];

  it('should calculate coverage for changed lines present in the coverage file', () => {
    const changedLines = {
      'app/components/text-field.tsx': new Set([10, 11, 12])
    };

    const results = calculateChangedLinesCoverage(coverageData, changedLines);

    expect(results.totalLines).toBe(3);
    expect(results.coveredLines).toBe(2);
    expect(results.coverage).toBeCloseTo(66.67, 1);
    expect(results.fileResults['app/components/text-field.tsx']).toEqual({
      totalLines: 3,
      coveredLines: 2,
      coverage: (2 / 3) * 100
    });
    expect(results.missingFromCoverage).toEqual([]);
  });

  it('should report PR changed files that are missing from the coverage file', () => {
    const changedLines = {
      'app/components/text-field.tsx': new Set([10]),
      'app/navigators/app-navigator.tsx': new Set([175, 176, 177]),
      'CHANGELOG.md': new Set([1, 2])
    };

    const results = calculateChangedLinesCoverage(coverageData, changedLines);

    expect(results.missingFromCoverage).toEqual([
      { file: 'app/navigators/app-navigator.tsx', changedLines: 3 },
      { file: 'CHANGELOG.md', changedLines: 2 }
    ]);
    expect(results.totalLines).toBe(1);
    expect(results.coveredLines).toBe(1);
  });

  it('should normalize leading ./ in coverage file paths', () => {
    const dataWithDotPrefix = [
      {
        file: './app/components/text-field.tsx',
        lines: {
          details: [{ line: 10, hit: 1 }]
        }
      }
    ];

    const changedLines = {
      'app/components/text-field.tsx': new Set([10]),
      'app/navigators/settings-navigator.tsx': new Set([15])
    };

    const results = calculateChangedLinesCoverage(dataWithDotPrefix, changedLines);

    expect(results.totalLines).toBe(1);
    expect(results.missingFromCoverage).toEqual([
      { file: 'app/navigators/settings-navigator.tsx', changedLines: 1 }
    ]);
  });

  it('should include changed files with no diff patch lines in missingFromCoverage', () => {
    const changedLines = {
      'app/navigators/work-navigator.tsx': new Set()
    };

    const results = calculateChangedLinesCoverage(coverageData, changedLines);

    expect(results.missingFromCoverage).toEqual([
      { file: 'app/navigators/work-navigator.tsx', changedLines: 0 }
    ]);
  });
});
