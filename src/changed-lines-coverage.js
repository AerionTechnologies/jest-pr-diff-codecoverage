/**
 * Calculate PR diff coverage from parsed coverage data and changed line sets.
 */
function calculateChangedLinesCoverage(coverageData, changedLines) {
  let totalChangedLines = 0;
  let coveredChangedLines = 0;
  const fileResults = {};

  const coverageFiles = new Set(
    coverageData.map(file => file.file.replace(/^\.\//, ''))
  );

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

  const missingFromCoverage = Object.entries(changedLines)
    .filter(([filePath]) => !coverageFiles.has(filePath))
    .map(([file, linesSet]) => ({
      file,
      changedLines: linesSet.size
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const overallCoverage = totalChangedLines > 0 ? (coveredChangedLines / totalChangedLines) * 100 : 100;

  return {
    totalLines: totalChangedLines,
    coveredLines: coveredChangedLines,
    coverage: overallCoverage,
    fileResults,
    missingFromCoverage
  };
}

module.exports = { calculateChangedLinesCoverage };
