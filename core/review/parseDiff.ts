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
  fileDiff: string,
  filepath: string,
): Promise<RangeInFileWithContents[]> {
  console.log("Extracting unique references...");
  const uniqueReferences = new Map<string, RangeInFileWithContents>();
  const ideUtils = new VsCodeIdeUtils();

  console.log("Diff output for filepath:", filepath);
  console.log("File diff:", fileDiff);
  const range = getDiffRange(fileDiff);
  console.log("Range:", range);

  // Handle the case where range is null
  if (range === null) {
    console.log(
      "No valid range found in the diff. Skipping reference extraction.",
    );
    return []; // Return an empty array as no references can be extracted
  }

  for (let line = range.start.line; line <= range.end.line; line++) {
    const references = await getReferencesForLine(filepath, line);
    console.log(`References for line ${line}:`, references);
    console.log("Type of references:", typeof references);
    console.log("Is references an array?", Array.isArray(references));

    for (let i = 0; i < references.length; i++) {
      const reference = references[i];
      const { filepath: refFilepath, range: refRange } = reference;
      const content = await ideUtils.readRangeInFile(refFilepath, refRange);
      if (!content) continue; // Skip if no content could be read
      console.log("Reference:", {
        filepath: refFilepath,
        range: refRange,
        content,
      });

      // Create a unique key for each reference
      const key = `${refFilepath}:${refRange.start.line}:${refRange.start.character}-${refRange.end.line}:${refRange.end.character}`;
      if (!uniqueReferences.has(key)) {
        uniqueReferences.set(key, {
          filepath: refFilepath,
          range: refRange,
          contents: content,
        });
      }
    }
  }

  // Convert the Map to an array and return
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

async function getReferencesForLine(
  filepath: string,
  line: number,
): Promise<RangeInFile[]> {
  const referenceInput = {
    uri: filepath,
    line: line,
    character: 0,
    name: "vscode.executeReferenceProvider" as const,
  };
  return await executeGotoProvider(referenceInput);
}

export async function padReferences(
  references: RangeInFile[],
  linesBefore: number = 5,
  linesAfter: number = 15,
): Promise<RangeInFileWithContents[]> {
  const paddedReferences: RangeInFileWithContents[] = [];
  const ideUtils = new VsCodeIdeUtils();

  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    let paddedRange: Range;
    let snippetContents: string | undefined;

    // Try to find parent symbol
    const parentSymbol = await ideUtils.getParentSymbol(
      ref.filepath,
      ref.range,
    );

    if (parentSymbol) {
      // Use parent symbol range if found
      paddedRange = {
        start: { line: parentSymbol.range.start.line, character: 0 },
        end: {
          line: parentSymbol.range.end.line,
          character: Number.MAX_SAFE_INTEGER,
        },
      };
    } else {
      // Fall back to simple padding if no parent symbol found
      const startLine = Math.max(0, ref.range.start.line - linesBefore);
      const endLine = ref.range.end.line + linesAfter;
      paddedRange = {
        start: { line: startLine, character: 0 },
        end: { line: endLine, character: Number.MAX_SAFE_INTEGER },
      };
    }

    snippetContents = await ideUtils.readRangeInFile(ref.filepath, paddedRange);

    if (snippetContents) {
      paddedReferences.push({
        filepath: ref.filepath,
        range: paddedRange,
        contents: snippetContents,
      });
    }
  }

  return paddedReferences;
}
