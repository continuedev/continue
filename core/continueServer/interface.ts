import { Chunk } from "../index.js";

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
  connected: boolean;
  url: URL | undefined;
  getUserToken(): string | undefined;
  getConfig(): Promise<{ configJson: string }>;
  getFromIndexCache<T extends ArtifactType>(
    keys: string[],
    artifactId: T,
    repoName: string | undefined,
  ): Promise<EmbeddingsCacheResponse<T>>;
}
