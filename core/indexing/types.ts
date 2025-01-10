import { IndexTag, IndexingProgressUpdate } from "../index.js";

export enum IndexResultType {
  Compute = "compute",
  Delete = "del",
  AddTag = "addTag",
  RemoveTag = "removeTag",
  UpdateLastUpdated = "updateLastUpdated",
}

export type MarkCompleteCallback = (
  items: PathAndCacheKey[],
  resultType: IndexResultType,
) => Promise<void>;

export interface CodebaseIndex {
  artifactId: string;
  relativeExpectedTime: number;
  update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate>;
}

export type PathAndCacheKey = {
  path: string;
  cacheKey: string;
};

export type RefreshIndexResults = {
  compute: PathAndCacheKey[];
  del: PathAndCacheKey[];
  addTag: PathAndCacheKey[];
  removeTag: PathAndCacheKey[];
};

export type RefreshIndex = (tag: IndexTag) => Promise<RefreshIndexResults>;
