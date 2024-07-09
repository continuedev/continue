import { ContextItemWithId } from "../index.js";
import { executeGotoProvider } from "../../extensions/vscode/src/autocomplete/lsp";
import { VsCodeIdeUtils } from "../../extensions/vscode/src/util/ideUtils";
import { RangeInFile } from "../index";


export interface RangeInFileWithContents {
  filepath: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  contents: string;
}

export function contextItemToRangeInFileWithContents(
  item: ContextItemWithId,
): RangeInFileWithContents {
  const lines = item.name.split("(")[1].split(")")[0].split("-");

  const rif: RangeInFileWithContents = {
    filepath: item.id.itemId,
    range: {
      start: {
        line: Number.parseInt(lines[0]),
        character: 0,
      },
      end: {
        line: Number.parseInt(lines[1]),
        character: 0,
      },
    },
    contents: item.content,
  };

  return rif;
}



export async function extractUniqueReferences(
  rif: RangeInFileWithContents,
): Promise<RangeInFileWithContents[]> {
  const uniqueReferences = new Map<string, RangeInFileWithContents>();
  const ideUtils = new VsCodeIdeUtils(); // Create an instance of VsCodeIdeUtils

  const lines = rif.contents.split("\n");
  for (let lineNumber = rif.range.start.line; lineNumber <= rif.range.end.line; lineNumber++) {
    const content = lines[lineNumber - rif.range.start.line];
    const gotoInput = {
      uri: rif.filepath,
      line: lineNumber,
      character: 0,
      name: "vscode.executeReferenceProvider" as const,
    };
    const definitions: RangeInFile[] = await executeGotoProvider(gotoInput);
    for (const definition of definitions) {
      const { filepath, range } = definition;
      const content = await ideUtils.readRangeInFile(filepath, range); // Use ideUtils to read file contents
      const rangeInFileWithContents: RangeInFileWithContents = {
        filepath,
        range: {
          start: { line: range.start.line, character: range.start.character },
          end: { line: range.end.line, character: range.end.character },
        },
        contents: content,
      };
      // Using the file path and range as a unique key
      const key = `${filepath}:${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
      if (!uniqueReferences.has(key)) {
        uniqueReferences.set(key, rangeInFileWithContents);
      }
    }
  }
  return Array.from(uniqueReferences.values());
}