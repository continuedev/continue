import { Chunk } from "../..";
import { CdnClient } from "../../util/CDNClient";

export interface SiteIndexingResults {
  chunks: (Chunk & { embedding: number[] })[];
  url: string;
  title: string;
}

export class DocsCache {
  static readonly DIR_PREFIX: string = "docs-cache";

  /**
   * Normalizes an embedding ID by stripping the constructor name part.
   * This is done because we don't care about the provider, just the
   * model and the max embedding chunk size.
   */
  static normalizeEmbeddingId(embeddingId: string): string {
    // Split by "::" and remove the first part (constructor name)
    const parts = embeddingId.split("::");
    if (parts.length <= 1) return embeddingId; // Return original if no "::" found

    // Return everything except the first part, joining with "::"
    return parts.slice(1).join("::");
  }

  static getFilepathForEmbeddingId(embeddingId: string, url: string): string {
    // Use normalized embedding ID for the cache key
    const normalizedEmbeddingId = DocsCache.normalizeEmbeddingId(embeddingId);
    const normalizedUrl = encodeURIComponent(url.replace(/\//g, "_"));

    // Organize by URL -> embedding ID for easier bulk deletion of a site
    const filepath = `${DocsCache.DIR_PREFIX}/${normalizedUrl}/${normalizedEmbeddingId}`;

    return filepath;
  }

  /**
   * Downloads cached site indexing results for a given embedding ID and URL
   * @param embeddingId The embedding ID
   * @param url The URL of the document
   * @returns The downloaded data as a string
   */
  static async getDocsCacheForUrl(
    embeddingId: string,
    url: string,
  ): Promise<string> {
    const filepath = this.getFilepathForEmbeddingId(embeddingId, url);
    return await CdnClient.downloadFromCdn(filepath);
  }
}
