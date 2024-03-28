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
    const userToken = await this.userToken;
    const response = await fetch(new URL("sync", this.serverUrl).href, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to sync remote config (HTTP ${response.status}): ${response.statusText}`,
      );
    }
    const data = await response.json();
    return data;
  }

  public async getFromIndexCache<T extends ArtifactType>(
    keys: string[],
    artifactId: T,
    repoName: string | undefined,
  ): Promise<EmbeddingsCacheResponse<T>> {
    if (repoName === undefined) {
      console.warn(
        "No repo name provided to getFromIndexCache, this may cause no results to be returned.",
      );
    }

    if (keys.length === 0) {
      return {
        files: {},
      };
    }
    const url = new URL("indexing/cache", this.serverUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.userToken}`,
      },
      body: JSON.stringify({
        keys,
        artifactId,
        repo: repoName ?? "NONE",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to retrieve from remote cache (HTTP ${response.status}): ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  }
}
