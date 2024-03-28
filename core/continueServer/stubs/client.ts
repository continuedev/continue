import {
  ArtifactType,
  EmbeddingsCacheResponse,
  IContinueServerClient,
} from "../interface";

export class ContinueServerClient implements IContinueServerClient {
  constructor(
    private readonly serverUrl: string,
    private readonly userToken: Promise<string | undefined>,
  ) {}

  public async getConfig(): Promise<{ configJson: string; configJs: string }> {
    throw new Error("Not Implemented");
  }

  public async getFromIndexCache<T extends ArtifactType>(
    keys: string[],
    artifactId: T,
    repoName: string | undefined,
  ): Promise<EmbeddingsCacheResponse<T>> {
    return { files: {} };
  }
}
