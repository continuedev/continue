export function canParseUrl(url: string): boolean {
  if ((URL as any)?.canParse) {
    return (URL as any).canParse(url);
  }
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

export function parseDataUrl(dataUrl: string): {
  mimeType: string;
  base64Data: string;
} {
  const urlParts = dataUrl.split(",");

  if (urlParts.length < 2) {
    throw new Error(
      "Invalid data URL format: expected 'data:type;base64,data' format",
    );
  }

  const [mimeType, ...base64Parts] = urlParts;
  const base64Data = base64Parts.join(",");

  return { mimeType, base64Data };
}

export function extractBase64FromDataUrl(dataUrl: string): string {
  return parseDataUrl(dataUrl).base64Data;
}

export function safeSplit(
  input: string,
  delimiter: string,
  expectedParts: number,
  errorContext: string = "input",
): string[] {
  const parts = input.split(delimiter);

  if (parts.length !== expectedParts) {
    throw new Error(
      `Invalid ${errorContext} format: expected ${expectedParts} parts separated by "${delimiter}", got ${parts.length}`,
    );
  }

  return parts;
}
