import { RangeInFile } from "../index.js";

export type RecentlyEditedRange = RangeInFile & {
  timestamp: number;
  lines: string[];
  symbols: Set<string>;
};

export function findMatchingRange(
  recentlyEditedRanges: RecentlyEditedRange[],
  linePrefix: string,
): RecentlyEditedRange | undefined {
  return recentlyEditedRanges.find((recentlyEditedRange) => {
    return recentlyEditedRange.lines.some((line) =>
      line.startsWith(linePrefix),
    );
  });
}
