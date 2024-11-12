import request from "request";

import { Chunk } from "../../";

export function getS3Filename(
  embeddingsProviderId: string,
  title: string,
): string {
  return `${embeddingsProviderId}/${title}`;
}

export enum S3Buckets {
  continueIndexedDocs = "continue-indexed-docs",
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
        reject(new Error("No body returned when downloading from S3 bucket"));
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
