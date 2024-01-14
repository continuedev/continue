export interface CodebaseIndex {
  artifactId: string;
  update(tag: IndexTag, results: RefreshIndexResults): AsyncGenerator<number>;
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
