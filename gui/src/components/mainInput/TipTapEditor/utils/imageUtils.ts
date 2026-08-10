import { IIdeMessenger } from "../../../../context/IdeMessenger";

const IMAGE_RESOLUTION = 1024;
const MAX_FILE_SIZE_MB = 10;

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

/**
 * Reads a non-image file as a data URL so it can be embedded in the editor and
 * history as a download-able attachment. Returns [name, dataUrl] or undefined.
 */
export async function handleFile(
  ideMessenger: IIdeMessenger,
  file: File,
): Promise<[string, string] | undefined> {
  const filesize = file.size / 1024 / 1024; // filesize in MB
  if (filesize > MAX_FILE_SIZE_MB) {
    ideMessenger.post("showToast", [
      "error",
      `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
    ]);
    return undefined;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  return [file.name, dataUrl];
}
