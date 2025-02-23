import QuickLRU from "quick-lru";

import { ToWebviewOrCoreFromIdeProtocol } from "../../protocol/ide.js";

// The cache key and value are both a filepath string
export type RecentlyEditedFilesCacheKeyAndValue =
  ToWebviewOrCoreFromIdeProtocol["didChangeActiveTextEditor"][0]["filepath"];

const MAX_NUM_RECENTLY_EDITED_FILES = 100;

export const recentlyEditedFilesCache = new QuickLRU<
  RecentlyEditedFilesCacheKeyAndValue,
  RecentlyEditedFilesCacheKeyAndValue
>({
  maxSize: MAX_NUM_RECENTLY_EDITED_FILES,
});
