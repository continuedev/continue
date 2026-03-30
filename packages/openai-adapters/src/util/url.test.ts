import { describe, expect, test } from "vitest";
import { extractBase64FromDataUrl, parseDataUrl } from "./url.js";

describe("parseDataUrl", () => {
  test("parses valid data URL with base64 data", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:image/png;base64",
      base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAUA",
    });
  });

  test("parses data URL with application/json mime type", () => {
    const dataUrl = "data:application/json;base64,eyJrZXkiOiJ2YWx1ZSJ9";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:application/json;base64",
      base64Data: "eyJrZXkiOiJ2YWx1ZSJ9",
    });
  });

  test("parses data URL with text/plain mime type", () => {
    const dataUrl = "data:text/plain;base64,SGVsbG8gV29ybGQ=";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:text/plain;base64",
      base64Data: "SGVsbG8gV29ybGQ=",
    });
  });

  test("returns undefined for URL without comma", () => {
    const dataUrl = "data:image/png;base64";
    const result = parseDataUrl(dataUrl);

    expect(result).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    const result = parseDataUrl("");

    expect(result).toBeUndefined();
  });

  test("handles data URL with multiple commas", () => {
    const dataUrl = "data:text/csv;base64,YSxiLGM=";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:text/csv;base64",
      base64Data: "YSxiLGM=",
    });
  });

  test("handles data URL with comma in base64 data", () => {
    // Base64 can contain commas in edge cases, ensure they're preserved
    const dataUrl = "data:text/plain,hello,world,test";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "data:text/plain",
      base64Data: "hello,world,test",
    });
  });

  test("handles minimal valid data URL", () => {
    const dataUrl = "a,b";
    const result = parseDataUrl(dataUrl);

    expect(result).toEqual({
      mimeType: "a",
      base64Data: "b",
    });
  });
});

describe("extractBase64FromDataUrl", () => {
  test("extracts base64 data from valid data URL", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("/9j/4AAQSkZJRg==");
  });

  test("returns undefined for invalid data URL", () => {
    const dataUrl = "not-a-data-url";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    const result = extractBase64FromDataUrl("");

    expect(result).toBeUndefined();
  });

  test("extracts base64 from data URL with complex mime type", () => {
    const dataUrl =
      "data:application/octet-stream;charset=utf-8;base64,SGVsbG8=";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("SGVsbG8=");
  });

  test("handles data URL with empty base64 portion", () => {
    const dataUrl = "data:text/plain,";
    const result = extractBase64FromDataUrl(dataUrl);

    expect(result).toBe("");
  });
});
