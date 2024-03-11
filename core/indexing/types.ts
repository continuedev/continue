import { IndexingProgressUpdate } from "..";

export enum IndexResultType {
  Compute = "compute",
  Delete = "del",
  AddTag = "addTag",
  RemoveTag = "removeTag",
}

export type MarkCompleteCallback = (
  items: PathAndCacheKey[],
  resultType: IndexResultType,
) => void;

export interface CodebaseIndex {
  artifactId: string;
  update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
  ): AsyncGenerator<IndexingProgressUpdate>;
}

export type PathAndCacheKey = {
  path: string;
  cacheKey: string;
};

export interface IndexTag {
  directory: string;
  branch: string;
  artifactId: string;
}

export type RefreshIndexResults = {
  compute: PathAndCacheKey[];
  del: PathAndCacheKey[];
  addTag: PathAndCacheKey[];
  removeTag: PathAndCacheKey[];
};

export type LastModifiedMap = {
  [path: string]: number;
};

export type RefreshIndex = (tag: IndexTag) => Promise<RefreshIndexResults>;
