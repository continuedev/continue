import type {
  ArtifactType,
  EmbeddingsCacheResponse,
  IContinueServerClient,
} from "../interface.js";

export class ContinueServerClient implements IContinueServerClient {
  url: URL | undefined;

  constructor(
    serverUrl: string | undefined,
    private readonly userToken: string | undefined,
  ) {
    try {
      this.url =
        typeof serverUrl !== "string" || serverUrl === ""
          ? undefined
          : new URL(serverUrl);
    } catch (e) {
      console.warn("Invalid Continue server url", e);
      this.url = undefined;
    }
  }

  getUserToken(): string | undefined {
    return this.userToken;
  }

  connected: boolean = false;

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

  public async sendFeedback(feedback: string, data: string): Promise<void> {
    if (!this.url) {
      return;
    }

    const url = new URL("feedback", this.url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.userToken}`,
      },
      body: JSON.stringify({
        feedback,
        data,
      }),
    });
  }
}
