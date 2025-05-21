// The parseDataLine function is not exported, so we need to import it
// indirectly by re-exporting it for testing purposes
import { parseDataLine } from "./stream.js";

describe("parseDataLine", () => {
  test("parseDataLine should parse valid JSON data with 'data: ' prefix", () => {
    const line = 'data: {"message":"hello","status":"ok"}';
    const result = parseDataLine(line);
    expect(result).toEqual({ message: "hello", status: "ok" });
  });

  test("parseDataLine should parse valid JSON data with 'data:' prefix (no space)", () => {
    const line = 'data:{"message":"hello","status":"ok"}';
    const result = parseDataLine(line);
    expect(result).toEqual({ message: "hello", status: "ok" });
  });

  test("parseDataLine should throw error for malformed JSON", () => {
    const line = "data: {invalid json}";
    expect(() => parseDataLine(line)).toThrow(
      "Malformed JSON sent from server",
    );
  });

  test("parseDataLine should throw error when data contains error field", () => {
    const line = 'data: {"error":"something went wrong"}';
    expect(() => parseDataLine(line)).toThrow(
      "Error streaming response: something went wrong",
    );
  });

  test("parseDataLine should handle empty objects", () => {
    const line = "data: {}";
    const result = parseDataLine(line);
    expect(result).toEqual({});
  });

  test("parseDataLine should handle arrays", () => {
    const line = "data: [1,2,3]";
    const result = parseDataLine(line);
    expect(result).toEqual([1, 2, 3]);
  });

  test("parseDataLine should handle nested objects", () => {
    const line = 'data: {"user":{"name":"John","age":30}}';
    const result = parseDataLine(line);
    expect(result).toEqual({ user: { name: "John", age: 30 } });
  });
});
