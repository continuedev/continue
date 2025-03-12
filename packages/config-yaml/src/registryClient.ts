import { Registry } from "./interfaces/index.js";
import { FullSlug } from "./interfaces/slugs.js";

export class RegistryClient implements Registry {
  async getContent(fullSlug: FullSlug): Promise<string> {
    const response = await fetch(
      `https://api.continue.dev/registry/v1/${fullSlug.ownerSlug}/${fullSlug.packageSlug}/${fullSlug.versionSlug}`,
    );
    const data = await response.json();
    return data.content;
  }
}
