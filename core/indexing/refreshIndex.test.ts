import { truncateToLastNBytes } from "./refreshIndex";

describe("truncateToLastNBytes", () => {
  it("should return full string if maxBytes greater than string byte length", () => {
    const input = "Hello World";
    const result = truncateToLastNBytes(input, 100);
    expect(result).toBe("Hello World");
  });

  it("should truncate ASCII string correctly", () => {
    const input = "Hello World";
    const result = truncateToLastNBytes(input, 5);
    expect(result).toBe("World");
  });

  it("should handle empty string", () => {
    const input = "";
    const result = truncateToLastNBytes(input, 5);
    expect(result).toBe("");
  });

  it("should handle UTF-8 characters correctly", () => {
    const input = "👋 Hello";
    // 👋 is 4 bytes, space is 1 byte
    const result = truncateToLastNBytes(input, 5);
    expect(result).toBe("Hello");
  });

  it("should handle maxBytes of 0", () => {
    const input = "Hello World";
    const result = truncateToLastNBytes(input, 0);
    expect(result).toBe("");
  });
});
