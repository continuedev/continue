import QuickLRU from "quick-lru";

// The cache key and value are both a filepath string
export type cacheElementType = string;

// maximum number of open files that can be cached
const MAX_NUM_OPEN_CONTEXT_FILES = 20;

// stores which files are currently open in the IDE, in viewing order
export const openedFilesLruCache = new QuickLRU<
  cacheElementType,
  cacheElementType
>({
  maxSize: MAX_NUM_OPEN_CONTEXT_FILES,
});

// used in core/core.ts to handle removals from the cache
export const prevFilepaths = {
  filepaths: [] as string[],
};
