/**
 * Normalize file paths for comparison between PR diffs and coverage data.
 */
function normalizePath(filePath) {
  return filePath.replace(/^\.\//, '').replace(/\\/g, '/');
}

/**
 * Calculate PR diff coverage from parsed coverage data and changed line sets.
 *
 * Only counts changed PR lines that appear in the coverage file with line hit data.
 * Changed lines without coverage data are listed separately and do not affect the percentage.
 */
function calculateChangedLinesCoverage(coverageData, changedLines) {
  let totalChangedLines = 0;
  let coveredChangedLines = 0;
  const fileResults = {};

  const coverageFiles = new Set(
    coverageData.map(file => normalizePath(file.file))
  );

  for (const file of coverageData) {
    const normalizedPath = normalizePath(file.file);
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
    .filter(([filePath]) => !coverageFiles.has(normalizePath(filePath)))
    .map(([file, linesSet]) => ({
      file: normalizePath(file),
      changedLines: linesSet.size
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const noTrackableLines = Object.entries(changedLines)
    .filter(([filePath]) => {
      const normalizedPath = normalizePath(filePath);
      return coverageFiles.has(normalizedPath) && !fileResults[normalizedPath];
    })
    .map(([file, linesSet]) => ({
      file: normalizePath(file),
      changedLines: linesSet.size
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const filesWithNoExecutableChanges = [...missingFromCoverage, ...noTrackableLines].sort((a, b) =>
    a.file.localeCompare(b.file)
  );

  const overallCoverage = totalChangedLines > 0 ? (coveredChangedLines / totalChangedLines) * 100 : 100;

  return {
    totalLines: totalChangedLines,
    coveredLines: coveredChangedLines,
    coverage: overallCoverage,
    fileResults,
    missingFromCoverage,
    noTrackableLines,
    filesWithNoExecutableChanges
  };
}

module.exports = { calculateChangedLinesCoverage, normalizePath };
