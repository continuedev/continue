import { describe, expect, it } from "vitest";
import { incrementalParseJson } from "./incrementalParseJson";

describe("incrementalParseJson", () => {
  describe("complete JSON parsing", () => {
    it("should parse complete JSON object", () => {
      const [isComplete, result] = incrementalParseJson('{"key": "value"}');
      expect(isComplete).toBe(true);
      expect(result).toEqual({ key: "value" });
    });

    it("should parse complete JSON array", () => {
      const [isComplete, result] = incrementalParseJson("[1, 2, 3]");
      expect(isComplete).toBe(true);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse complete JSON string", () => {
      const [isComplete, result] = incrementalParseJson('"hello"');
      expect(isComplete).toBe(true);
      expect(result).toBe("hello");
    });

    it("should parse complete JSON number", () => {
      const [isComplete, result] = incrementalParseJson("42");
      expect(isComplete).toBe(true);
      expect(result).toBe(42);
    });

    it("should parse complete JSON boolean", () => {
      const [isComplete, result] = incrementalParseJson("true");
      expect(isComplete).toBe(true);
      expect(result).toBe(true);
    });

    it("should parse complete JSON null", () => {
      const [isComplete, result] = incrementalParseJson("null");
      expect(isComplete).toBe(true);
      expect(result).toBeNull();
    });

    it("should parse nested JSON object", () => {
      const json = '{"outer": {"inner": "value"}, "array": [1, 2, 3]}';
      const [isComplete, result] = incrementalParseJson(json);
      expect(isComplete).toBe(true);
      expect(result).toEqual({ outer: { inner: "value" }, array: [1, 2, 3] });
    });
  });

  describe("partial JSON parsing", () => {
    it("should parse incomplete JSON object", () => {
      const [isComplete, result] = incrementalParseJson('{"key": "val');
      expect(isComplete).toBe(false);
      expect(result).toEqual({ key: "val" });
    });

    it("should parse incomplete JSON object missing closing brace", () => {
      const [isComplete, result] = incrementalParseJson('{"key": "value"');
      expect(isComplete).toBe(false);
      expect(result).toEqual({ key: "value" });
    });

    it("should parse incomplete JSON array", () => {
      const [isComplete, result] = incrementalParseJson("[1, 2, 3");
      expect(isComplete).toBe(false);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse incomplete nested JSON", () => {
      const [isComplete, result] = incrementalParseJson(
        '{"outer": {"inner": "val',
      );
      expect(isComplete).toBe(false);
      expect(result).toEqual({ outer: { inner: "val" } });
    });

    it("should parse incomplete string value", () => {
      const [isComplete, result] = incrementalParseJson('{"name": "John Do');
      expect(isComplete).toBe(false);
      expect(result).toEqual({ name: "John Do" });
    });
  });

  describe("invalid JSON handling", () => {
    it("should return empty object for completely invalid JSON", () => {
      const [isComplete, result] = incrementalParseJson("not json at all");
      expect(isComplete).toBe(false);
      expect(result).toEqual({});
    });

    it("should return empty object for empty string", () => {
      const [isComplete, result] = incrementalParseJson("");
      expect(isComplete).toBe(false);
      expect(result).toEqual({});
    });

    it("should return empty object for just whitespace", () => {
      const [isComplete, result] = incrementalParseJson("   ");
      expect(isComplete).toBe(false);
      expect(result).toEqual({});
    });

    it("should return empty object for malformed JSON syntax", () => {
      const [isComplete, result] = incrementalParseJson("{key: value}");
      expect(isComplete).toBe(false);
      expect(result).toEqual({});
    });
  });

  describe("edge cases", () => {
    it("should handle JSON with whitespace", () => {
      const [isComplete, result] = incrementalParseJson(
        '  { "key" :  "value"  }  ',
      );
      expect(isComplete).toBe(true);
      expect(result).toEqual({ key: "value" });
    });

    it("should handle JSON with special characters in strings", () => {
      const [isComplete, result] = incrementalParseJson(
        '{"text": "hello\\nworld"}',
      );
      expect(isComplete).toBe(true);
      expect(result).toEqual({ text: "hello\nworld" });
    });

    it("should handle JSON with unicode characters", () => {
      const [isComplete, result] = incrementalParseJson(
        '{"emoji": "\\u263A", "text": "hello"}',
      );
      expect(isComplete).toBe(true);
      expect(result).toEqual({ emoji: "☺", text: "hello" });
    });

    it("should handle deeply nested JSON", () => {
      const [isComplete, result] = incrementalParseJson(
        '{"a": {"b": {"c": {"d": "value"}}}}',
      );
      expect(isComplete).toBe(true);
      expect(result).toEqual({ a: { b: { c: { d: "value" } } } });
    });

    it("should handle mixed arrays and objects", () => {
      const json = '[{"a": 1}, {"b": [2, 3]}, {"c": {"d": 4}}]';
      const [isComplete, result] = incrementalParseJson(json);
      expect(isComplete).toBe(true);
      expect(result).toEqual([{ a: 1 }, { b: [2, 3] }, { c: { d: 4 } }]);
    });

    it("should handle floating point numbers", () => {
      const [isComplete, result] = incrementalParseJson(
        '{"value": 3.14159, "negative": -2.5}',
      );
      expect(isComplete).toBe(true);
      expect(result).toEqual({ value: 3.14159, negative: -2.5 });
    });

    it("should handle scientific notation", () => {
      const [isComplete, result] = incrementalParseJson('{"value": 1.5e10}');
      expect(isComplete).toBe(true);
      expect(result).toEqual({ value: 1.5e10 });
    });
  });

  describe("streaming use cases", () => {
    it("should handle progressive JSON building", () => {
      const stages = [
        '{"name": "',
        '{"name": "John',
        '{"name": "John Doe"',
        '{"name": "John Doe"}',
      ];

      for (let i = 0; i < stages.length; i++) {
        const [isComplete, result] = incrementalParseJson(stages[i]);

        if (i < stages.length - 1) {
          expect(isComplete).toBe(false);
        } else {
          expect(isComplete).toBe(true);
          expect(result).toEqual({ name: "John Doe" });
        }
      }
    });

    it("should handle array building", () => {
      const stages = ["[1", "[1, 2", "[1, 2, 3", "[1, 2, 3]"];

      for (let i = 0; i < stages.length; i++) {
        const [isComplete, result] = incrementalParseJson(stages[i]);

        if (i < stages.length - 1) {
          expect(isComplete).toBe(false);
        } else {
          expect(isComplete).toBe(true);
        }
        expect(result).toEqual([1, 2, 3].slice(0, i + 1));
      }
    });
  });
});
