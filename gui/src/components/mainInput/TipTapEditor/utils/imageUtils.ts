import { IIdeMessenger } from "../../../../context/IdeMessenger";

const IMAGE_RESOLUTION = 1024;

/**
 * Extracts the file path from a VS Code resource URL
 * Example: "https://file+.vscode-resource.vscode-cdn.net/Users/path/to/file.jpg?version=123"
 * Returns: "/Users/path/to/file.jpg"
 */
export function extractFilePathFromVSCodeResourceUrl(
  url: string,
): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "file+.vscode-resource.vscode-cdn.net") {
      return decodeURIComponent(urlObj.pathname);
    }
    return null;
  } catch (error) {
    console.error("Error parsing VS Code resource URL:", error);
    return null;
  }
}

/**
 * Handles VS Code resource URLs by converting them to data URLs
 * @param ideMessenger - The IDE messenger to communicate with VS Code
 * @param vscodeResourceUrl - The VS Code resource URL
 * @returns Promise with the data URL if successful, undefined otherwise
 */
export async function handleVSCodeResourceUrl(
  ideMessenger: IIdeMessenger,
  vscodeResourceUrl: string,
): Promise<string | undefined> {
  const filepath = extractFilePathFromVSCodeResourceUrl(vscodeResourceUrl);
  if (!filepath) {
    console.error(
      "Could not extract file path from VS Code resource URL:",
      vscodeResourceUrl,
    );
    return undefined;
  }

  console.log("Extracted filepath:", filepath);

  try {
    console.log("Requesting readFileAsDataUrl for filepath:", filepath);
    console.log("About to call ideMessenger.request...");

    // Add a timeout wrapper to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Request timeout after 10 seconds")),
        10000,
      ),
    );

    const requestPromise = ideMessenger.request("readFileAsDataUrl", {
      filepath,
    });

    console.log("Request promise created, waiting for response...");

    const response = await Promise.race([requestPromise, timeoutPromise]);

    console.log("Got response from ideMessenger.request:", response);
    console.log("Response type:", typeof response);

    // The response should be a WebviewSingleMessage which has status and content
    if (response && typeof response === "object" && "status" in response) {
      const typedResponse = response as {
        status: string;
        error?: string;
        content?: string;
      };
      if (typedResponse.status === "error") {
        console.error("Error reading file as data URL:", typedResponse.error);
        return undefined;
      }

      if (typedResponse.status === "success" && typedResponse.content) {
        const dataUrl = typedResponse.content;
        console.log(
          "Successfully got data URL for file, content length:",
          dataUrl.length,
        );
        return dataUrl;
      }
    }

    // If response is directly a string (shouldn't happen based on protocol but just in case)
    if (typeof response === "string") {
      console.log("Got direct string response, length:", response.length);
      return response;
    }

    console.error("Unexpected response format:", response);
    return undefined;
  } catch (error) {
    console.error("Exception caught when reading file as data URL:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    return undefined;
  }
}

/**
 * Extracts VS Code resource URL from HTML content
 * @param html - HTML string that may contain VS Code resource URLs
 * @returns The VS Code resource URL if found, null otherwise
 */
export function extractVSCodeResourceUrlFromHtml(html: string): string | null {
  try {
    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Look for img tags with VS Code resource URLs
    const imgTags = tempDiv.querySelectorAll("img");
    for (const img of imgTags) {
      const src = img.getAttribute("src");
      if (src && src.includes("file+.vscode-resource.vscode-cdn.net")) {
        return src;
      }
    }

    return null;
  } catch (error) {
    console.error("Error parsing HTML for VS Code resource URL:", error);
    return null;
  }
}

/**
 * Handles HTML content that contains VS Code resource URLs and converts them to usable data URLs
 * @param ideMessenger - The IDE messenger to communicate with VS Code
 * @param html - HTML string containing VS Code resource URLs
 * @returns Promise with the data URL if successful, undefined otherwise
 */
export async function handleVSCodeResourceFromHtml(
  ideMessenger: IIdeMessenger,
  html: string,
): Promise<string | undefined> {
  console.log("Processing HTML for VS Code resource URL:", html);

  const vscodeResourceUrl = extractVSCodeResourceUrlFromHtml(html);
  if (!vscodeResourceUrl) {
    console.log("No VS Code resource URL found in HTML");
    return undefined;
  }

  console.log("Found VS Code resource URL:", vscodeResourceUrl);
  return await handleVSCodeResourceUrl(ideMessenger, vscodeResourceUrl);
}

export function getDataUrlForFile(
  file: File,
  img: HTMLImageElement,
): string | undefined {
  const targetWidth = IMAGE_RESOLUTION;
  const targetHeight = IMAGE_RESOLUTION;
  const scaleFactor = Math.min(
    targetWidth / img.width,
    targetHeight / img.height,
  );

  const canvas = document.createElement("canvas");
  canvas.width = img.width * scaleFactor;
  canvas.height = img.height * scaleFactor;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Error getting image data url: 2d context not found");
    return;
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const downsizedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
  return downsizedDataUrl;
}

export async function handleImageFile(
  ideMessenger: IIdeMessenger,
  file: File,
): Promise<[HTMLImageElement, string] | undefined> {
  let filesize = file.size / 1024 / 1024; // filesize in MB
  // check image type and size
  if (
    [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/svg",
      "image/webp",
    ].includes(file.type) &&
    filesize < 10
  ) {
    // check dimensions
    let _URL = window.URL || window.webkitURL;
    let img = new window.Image();
    img.src = _URL.createObjectURL(file);

    return await new Promise((resolve) => {
      img.onload = function () {
        const dataUrl = getDataUrlForFile(file, img);
        if (!dataUrl) {
          return;
        }

        let image = new window.Image();
        image.src = dataUrl;
        image.onload = function () {
          resolve([image, dataUrl]);
        };
      };
    });
  } else {
    ideMessenger.post("showToast", [
      "error",
      "Images need to be in jpg or png format and less than 10MB in size.",
    ]);
  }
}
