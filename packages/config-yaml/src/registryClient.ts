import { Registry } from "./interfaces/index.js";
import { FullSlug } from "./interfaces/slugs.js";

export class RegistryClient implements Registry {
  constructor(
    private readonly accessToken?: string,
    private readonly apiBase: string = "https://api.continue.dev/",
  ) {
    if (!this.apiBase.endsWith("/")) {
      this.apiBase += "/";
    }
  }
  async getContent(fullSlug: FullSlug): Promise<string> {
    const response = await fetch(
      `${this.apiBase}registry/v1/${fullSlug.ownerSlug}/${fullSlug.packageSlug}/${fullSlug.versionSlug}`,
      {
        headers: {
          ...(this.accessToken
            ? { Authorization: `Bearer ${this.accessToken}` }
            : {}),
        },
      },
    );
    const data = await response.json();
    return data.content;
  }
}
