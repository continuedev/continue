import { ContextItemWithId } from "..";

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
    filepath: item.description.split(" (")[0],
    range: {
      start: {
        line: parseInt(lines[0]),
        character: 0,
      },
      end: {
        line: parseInt(lines[1]),
        character: 0,
      },
    },
    contents: item.content,
  };

  return rif;
}
