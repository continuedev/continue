import { describe, expect, it } from "vitest";
import { extractBase64FromDataUrl, parseDataUrl } from "./url.js";

describe("parseDataUrl", () => {
  it("should parse a valid data URL with base64 data", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:image/png;base64",
      base64Data: "iVBORw0KGgo",
    });
  });

  it("should parse a data URL with multiple commas in the base64 data", () => {
    const dataUrl = "data:text/plain;base64,abc,def,ghi";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:text/plain;base64",
      base64Data: "abc,def,ghi",
    });
  });

  it("should return undefined for a data URL without a comma", () => {
    const dataUrl = "data:image/png;base64";
    const result = parseDataUrl(dataUrl);

    expect(result).toBeUndefined();
  });

  it("should return undefined for an empty string", () => {
    const dataUrl = "";
    const result = parseDataUrl(dataUrl);

    expect(result).toBeUndefined();
  });

  it("should handle a data URL with empty base64 data", () => {
    const dataUrl = "data:image/png;base64,";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:image/png;base64",
      base64Data: "",
    });
  });

  it("should handle a data URL with just a comma", () => {
    const dataUrl = ",abc123";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "",
      base64Data: "abc123",
    });
  });
});

describe("extractBase64FromDataUrl", () => {
  it("should extract base64 data from a valid data URL", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("/9j/4AAQSkZJRg");
  });

  it("should return undefined for an invalid data URL", () => {
    const dataUrl = "invalid-data-url";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBeUndefined();
  });

  it("should handle data URLs with multiple commas", () => {
    const dataUrl = "data:text/csv,col1,col2,col3";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("col1,col2,col3");
  });

  it("should return empty string for data URL with empty content", () => {
    const dataUrl = "data:text/plain,";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("");
  });
});
