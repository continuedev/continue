import {
  ArtifactType,
  EmbeddingsCacheResponse,
  IContinueServerClient,
} from "../interface.js";

export class ContinueServerClient implements IContinueServerClient {
  url: URL | undefined;

  constructor(
    serverUrl: string | undefined,
    private readonly userToken: Promise<string | undefined>,
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

  getUserToken(): Promise<string | undefined> {
    return this.userToken;
  }

  connected: boolean = false;

  public async getConfig(): Promise<{ configJson: string; configJs: string }> {
    const response = await fetch(new URL("sync", this.serverUrl).href, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${await this.userToken}`,
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
    const url = new URL("indexing/cache", this.serverUrl);
    url.searchParams.append("keys", keys.join(","));
    url.searchParams.append("artifactId", artifactId);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${await this.userToken}`,
      },
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
