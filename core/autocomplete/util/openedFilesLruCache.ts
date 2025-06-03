import QuickLRU from "quick-lru";

import { ToWebviewOrCoreFromIdeProtocol } from "../../protocol/ide.js";

// The cache key and value are both a filepath string
export type cacheElementType =
  ToWebviewOrCoreFromIdeProtocol["didChangeActiveTextEditor"][0]["filepath"];

// maximum number of open files that can be cached
const MAX_NUM_OPEN_CONTEXT_FILES = 10;

export const openedFilesLruCache = new QuickLRU<
  cacheElementType,
  cacheElementType
>({
  maxSize: MAX_NUM_OPEN_CONTEXT_FILES,
});
