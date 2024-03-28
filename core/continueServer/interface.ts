import { Chunk } from "..";

export interface EmbeddingsCacheChunk {
  vector: number[];
  startLine: number;
  endLine: number;
  contents: string;
}

interface ArtifactReturnTypes {
  chunks: Chunk[];
  embeddings: EmbeddingsCacheChunk[];
}

export type ArtifactType = keyof ArtifactReturnTypes;

export interface EmbeddingsCacheResponse<T extends ArtifactType> {
  files: { [cacheKey: string]: ArtifactReturnTypes[T] };
}

export interface IContinueServerClient {
  getConfig(): Promise<{ configJson: string; configJs: string }>;
  getFromIndexCache<T extends ArtifactType>(
    keys: string[],
    artifactId: T,
    repoName: string | undefined,
  ): Promise<EmbeddingsCacheResponse<T>>;
}
