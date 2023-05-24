import { RangeInFile } from "../../../src/client";

export function readRangeInVirtualFileSystem(
  rangeInFile: RangeInFile,
  filesystem: { [filepath: string]: string }
): string | undefined {
  const range = rangeInFile.range;

  let data = filesystem[rangeInFile.filepath];
  if (data === undefined) {
    console.log("File not found");
    return undefined;
  } else {
    let lines = data.toString().split("\n");
    if (range.start.line === range.end.line) {
      return lines[rangeInFile.range.start.line].slice(
        rangeInFile.range.start.character,
        rangeInFile.range.end.character
      );
    } else {
      let firstLine = lines[range.start.line].slice(range.start.character);
      let lastLine = lines[range.end.line].slice(0, range.end.character);
      let middleLines = lines.slice(range.start.line + 1, range.end.line);
      return [firstLine, ...middleLines, lastLine].join("\n");
    }
  }
}
