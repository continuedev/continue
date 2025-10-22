import { IDE, Range } from "..";

export function getRangeFromFileContents(contents: string, range: Range) {
  const lines = contents.split("\n");
  return `${lines.slice(range.start.line, range.end.line).join("\n")}\n${lines[
    range.end.line < lines.length - 1 ? range.end.line : lines.length - 1
  ].slice(0, range.end.character)}`;
}

export async function readRangeInFile(ide: IDE, uri: string, range: Range) {
  console.log("READ RANGE IN FILE");
  const contents = await ide.readFile(uri);
  return getRangeFromFileContents(contents, range);
}
