import { executeGotoProvider } from "../../extensions/vscode/src/autocomplete/lsp.js";
import { VsCodeIdeUtils } from "../../extensions/vscode/src/util/ideUtils.js";
import { RangeInFile, Range } from "../index.js";

import { RangeInFileWithContents } from "../commands/util.js";

export function getDiffPerFile(diff: string): { [filepath: string]: string } {
  /**
     * Example of the lines before the diff for each file:
     a/core/index.d.ts b/core/index.d.ts
     index 18f88a2c..719fd6d2 100644
     --- a/core/index.d.ts
     +++ b/core/index.d.ts
     */
  const perFile: { [filepath: string]: string } = {};

  const parts = diff.split("diff --git ").slice(1);
  for (const part of parts) {
    const lines = part.split("\n");
    // Splitting a line like this: `a/core/index.d.ts b/core/index.d.ts`
    const filepath = lines[0].slice(2).split(" ")[0];
    const diff = lines.slice(4).join("\n");
    perFile[filepath] = diff;
  }

  return perFile;
}

export function getChangedFiles(diff: string): string[] {
  const parts = diff.split("diff --git ").slice(1);
  return parts.map((part) => part.split("\n")[0].slice(2).split(" ")[0]);
}

export async function extractUniqueReferences(
  diff: string,
): Promise<RangeInFileWithContents[]> {
  const uniqueReferences = new Map<string, RangeInFileWithContents>();
  const ideUtils = new VsCodeIdeUtils();
  const diffPerFile = getDiffPerFile(diff);

  for (const [filepath, fileDiff] of Object.entries(diffPerFile)) {
    const range = getDiffRange(fileDiff);
    if (!range) continue;

    const rif: RangeInFile = { filepath, range };

    for (let line = range.start.line; line <= range.end.line; line++) {
      const definitions = await getDefinitionsForLine(filepath, line);

      for (const definition of definitions) {
        const { filepath: defFilepath, range: defRange } = definition;
        const content = await ideUtils.readRangeInFile(defFilepath, defRange);

        const key = `${defFilepath}:${defRange.start.line}:${defRange.start.character}-${defRange.end.line}:${defRange.end.character}`;
        if (!uniqueReferences.has(key)) {
          uniqueReferences.set(key, {
            filepath: defFilepath,
            range: defRange,
            contents: content,
          });
        }
      }
    }
  }

  return Array.from(uniqueReferences.values());
}

function getDiffRange(fileDiff: string): Range | null {
  const lines = fileDiff.split("\n");
  let startLine: number | null = null;
  let endLine: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+,?\d* \+(\d+),?(\d*) @@/);
      if (match) {
        startLine = parseInt(match[1]) - 1; // Convert to 0-based index
        const lineCount = match[2] ? parseInt(match[2]) : 1;
        endLine = startLine + lineCount - 1;
        break;
      }
    }
  }

  if (startLine === null || endLine === null) return null;

  return {
    start: { line: startLine, character: 0 },
    end: { line: endLine, character: Number.MAX_SAFE_INTEGER },
  };
}

async function getDefinitionsForLine(
  filepath: string,
  line: number,
): Promise<RangeInFile[]> {
  const gotoInput = {
    uri: filepath,
    line: line,
    character: 0,
    name: "vscode.executeDefinitionProvider" as const,
  };
  return await executeGotoProvider(gotoInput);
}
