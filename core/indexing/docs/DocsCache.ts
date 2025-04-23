import request from "request";
import { Chunk } from "../..";

export interface SiteIndexingResults {
  chunks: (Chunk & { embedding: number[] })[];
  url: string;
  title: string;
}

export class DocsCache {
  static readonly AWS_REGION: string = "us-west-1";
  static readonly BUCKET_NAME: string = "continue-preindexed-docs";

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

  /**
   * Gets the filepath for a given embedding ID and URL
   */
  static getFilepathForEmbeddingIdAndUrl(
    embeddingId: string,
    url: string,
  ): string {
    const normalizedEmbeddingId = DocsCache.normalizeEmbeddingId(embeddingId);
    const normalizedUrl = encodeURIComponent(url.replace(/\//g, "_"));
    return normalizedEmbeddingId + "/" + normalizedUrl;
  }

  /**
   * Gets the fully qualified S3 URL for a given filepath
   */
  private static getS3Url(filepath: string): string {
    const pathname = filepath.split("/").map(encodeURIComponent).join("/");
    return `https://${this.BUCKET_NAME}.s3.${this.AWS_REGION}.amazonaws.com/${pathname}`;
  }

  /**
   * Downloads cached site indexing results from S3 for a given embedding ID and URL
   * @param embeddingId The embedding ID
   * @param url The URL of the document
   * @returns The downloaded data as a string
   */
  static async getDocsCacheForUrl(
    embeddingId: string,
    url: string,
  ): Promise<string> {
    const filepath = DocsCache.getFilepathForEmbeddingIdAndUrl(
      embeddingId,
      url,
    );

    return new Promise<string>((resolve, reject) => {
      let data = "";
      const url = this.getS3Url(filepath);
      const download = request({
        url,
      });

      download.on("response", (response: any) => {
        if (response.statusCode !== 200) {
          reject(
            new Error("There was an error retrieving the pre-indexed doc"),
          );
        }
      });

      download.on("error", (err: any) => reject(err));
      download.on("data", (chunk: any) => (data += chunk));
      download.on("end", () => resolve(data));
    });
  }
}
