import { toolResultToAiSdkContent } from "./aiSdkAdapter.js";

describe("toolResultToAiSdkContent", () => {
  it("should convert a string result to a text content part", () => {
    const result = toolResultToAiSdkContent("Content of file.txt:\nhello");

    expect(result).toEqual([
      { type: "text", text: "Content of file.txt:\nhello" },
    ]);
  });

  it("should convert a multipart result with text and image parts", () => {
    const result = toolResultToAiSdkContent({
      type: "multipart",
      parts: [
        { type: "text", text: "Image file: screenshot.png (245KB, image/png)" },
        {
          type: "image",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          mimeType: "image/png",
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "text",
      text: "Image file: screenshot.png (245KB, image/png)",
    });
    expect(result[1]).toEqual({
      type: "image",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      mimeType: "image/png",
    });
  });

  it("should handle multipart result with only text parts", () => {
    const result = toolResultToAiSdkContent({
      type: "multipart",
      parts: [
        { type: "text", text: "Line 1" },
        { type: "text", text: "Line 2" },
      ],
    });

    expect(result).toEqual([
      { type: "text", text: "Line 1" },
      { type: "text", text: "Line 2" },
    ]);
  });

  it("should handle empty text gracefully", () => {
    const result = toolResultToAiSdkContent({
      type: "multipart",
      parts: [{ type: "text" }],
    });

    expect(result).toEqual([{ type: "text", text: "" }]);
  });

  it("should default image mimeType to image/png", () => {
    const result = toolResultToAiSdkContent({
      type: "multipart",
      parts: [{ type: "image", data: "abc123" }],
    });

    expect(result).toEqual([
      { type: "image", data: "abc123", mimeType: "image/png" },
    ]);
  });
});
