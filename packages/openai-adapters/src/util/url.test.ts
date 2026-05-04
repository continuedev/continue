import { describe, expect, it } from "vitest";

import { extractBase64FromDataUrl, parseDataUrl } from "./url.js";

describe("parseDataUrl", () => {
  it("should parse a valid data URL with base64 encoding", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:image/png;base64",
      base64Data: "iVBORw0KGgoAAAANSUhEUg==",
    });
  });

  it("should parse a data URL with minimal content", () => {
    const dataUrl = "data:text/plain,hello";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:text/plain",
      base64Data: "hello",
    });
  });

  it("should handle base64 data containing commas", () => {
    const dataUrl = "data:text/plain;base64,SGVsbG8sV29ybGQ=";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:text/plain;base64",
      base64Data: "SGVsbG8sV29ybGQ=",
    });
  });

  it("should handle multiple commas in base64 data", () => {
    // Base64 can technically contain comma-like patterns if the data is odd
    const dataUrl = "data:text/plain,part1,part2,part3";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:text/plain",
      base64Data: "part1,part2,part3",
    });
  });

  it("should return undefined for data URL without comma", () => {
    const dataUrl = "data:image/png;base64";
    const result = parseDataUrl(dataUrl);

    expect(result).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    const dataUrl = "";
    const result = parseDataUrl(dataUrl);

    expect(result).toBeUndefined();
  });

  it("should handle data URL with empty base64 data", () => {
    const dataUrl = "data:text/plain,";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:text/plain",
      base64Data: "",
    });
  });

  it("should handle various image mime types", () => {
    const jpegUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const gifUrl =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    expect(parseDataUrl(jpegUrl)).toEqual({
      mimeType: "data:image/jpeg;base64",
      base64Data: "/9j/4AAQSkZJRg==",
    });

    expect(parseDataUrl(gifUrl)).toEqual({
      mimeType: "data:image/gif;base64",
      base64Data: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    });
  });

  it("should handle application mime types", () => {
    const jsonUrl = "data:application/json;base64,eyJrZXkiOiJ2YWx1ZSJ9";
    const result = parseDataUrl(jsonUrl);

    expect(result).toEqual({
      mimeType: "data:application/json;base64",
      base64Data: "eyJrZXkiOiJ2YWx1ZSJ9",
    });
  });
});

describe("extractBase64FromDataUrl", () => {
  it("should extract base64 data from a valid data URL", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("iVBORw0KGgoAAAANSUhEUg==");
  });

  it("should return undefined for invalid data URL", () => {
    const dataUrl = "data:image/png;base64";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    const result = extractBase64FromDataUrl("");

    expect(result).toBeUndefined();
  });

  it("should extract data containing commas", () => {
    const dataUrl = "data:text/plain,part1,part2,part3";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("part1,part2,part3");
  });

  it("should extract empty string for data URL with empty content", () => {
    const dataUrl = "data:text/plain,";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("");
  });
});
