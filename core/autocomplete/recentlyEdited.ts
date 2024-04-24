import { RangeInFileWithContents } from "../commands/util";

export type RecentlyEditedRange = RangeInFileWithContents & {
  timestamp: number;
};
