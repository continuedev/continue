import request from "request";

import { Chunk } from "../../";

/**
 * Generate a standardized S3 cache key for any doc URL.
 * This creates a predictable cache key format based on the embedding provider and URL.
 */
export function getS3CacheKey(embeddingsProviderId: string, url: string): string {
  // URL-encode and normalize the URL to use as cache key
  const normalizedUrl = encodeURIComponent(url);
  return `${embeddingsProviderId}/${normalizedUrl}`;
}

export enum S3Buckets {
  docsEmbeddingsCache = "continue-indexed-docs", // Keeping same bucket name for compatibility
}

const AWS_REGION = "us-west-1";

export async function downloadFromS3(
  bucket: string,
  fileName: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let data = "";

    const download = request({
      url: `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${fileName}`,
    });
    download.on("response", (response: any) => {
      if (response.statusCode !== 200) {
        reject(new Error("There was an error retrieving the cached document"));
      }
    });

    download.on("error", (err: any) => {
      reject(err);
    });

    download.on("data", (chunk: any) => {
      data += chunk;
    });

    download.on("end", () => {
      resolve(data);
    });
  });
}

export interface SiteIndexingResults {
  chunks: (Chunk & { embedding: number[] })[];
  url: string;
  title: string;
}
