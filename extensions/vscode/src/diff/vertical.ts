interface DiffBlock {
  startLine: number;
  endLine: number;
  replacement: string[];
}

function linesMatch(lineA: string, lineB: string): boolean {
  return lineA === lineB;
}

function matchLine(newLine: string, oldLines: string[]): number {
  let matchIndex = -1;
  for (let i = 0; i < oldLines.length; i++) {
    if (linesMatch(newLine, oldLines[i])) {
      matchIndex = i;
      break;
    }
  }

  return matchIndex;
}

async function* streamDiffBlocks(
  newLinesStream: AsyncGenerator<string>,
  oldCode: string
): AsyncGenerator<DiffBlock> {}

// But you also want to stream between the diff blocks.
// So...not only do you want to stream DiffBlocks
// Next is stream lines: {line: string, type: "match" | ""}
