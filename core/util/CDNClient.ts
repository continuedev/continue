import request from "request";

/**
 * Generic CDN client for handling downloads from content delivery networks
 */
export class CdnClient {
  // Define the CDN base URL as a static readonly property
  private static readonly CDN_BASE_URL: string = "cdn.continue.dev";

  /**
   * Gets the fully qualified CDN URL for a given filepath
   */
  static getCdnUrlForFilename(filepath: string): string {
    return `https://${CdnClient.CDN_BASE_URL}/${filepath}`;
  }

  /**
   * Downloads a file from the CDN
   * @param filepath The path to the file on the CDN
   * @returns The downloaded data as a string
   */
  static async downloadFromCdn(filepath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let data = "";
      const download = request({
        url: CdnClient.getCdnUrlForFilename(filepath),
      });

      download.on("response", (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error("There was an error retrieving the file from CDN"));
        }
      });

      download.on("error", (err: any) => reject(err));
      download.on("data", (chunk: any) => (data += chunk));
      download.on("end", () => resolve(data));
    });
  }
}
