export function parseDataUrl(dataUrl: string):
  | {
      mimeType: string;
      base64Data: string;
    }
  | undefined {
  const urlParts = dataUrl.split(",");

  if (urlParts.length < 2) {
    return undefined;
  }

  const [mimeType, ...base64Parts] = urlParts;
  const base64Data = base64Parts.join(",");

  return { mimeType, base64Data };
}

export function extractBase64FromDataUrl(dataUrl: string): string | undefined {
  return parseDataUrl(dataUrl)?.base64Data;
}
