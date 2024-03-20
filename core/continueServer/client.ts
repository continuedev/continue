export interface EmbeddingsCacheChunk {
  vector: number[];
  startLine: number;
  endLine: number;
  contents: string;
}

export interface EmbeddingsCacheResponse {
  files: { [cacheKey: string]: EmbeddingsCacheChunk[] };
}
export class ContinueServerClient {
  constructor(
    private readonly serverUrl: string,
    private readonly userToken: Promise<string | undefined>,
  ) {}

  public async getConfig(): Promise<{ configJson: string; configJs: string }> {
    throw new Error("Not Implemented");
  }

  public async getFromIndexCache(
    keys: string[],
    artifactId: string,
  ): Promise<EmbeddingsCacheResponse> {
    return { files: {} };
  }
}
