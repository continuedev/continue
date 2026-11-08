import { describe, expect, test } from "vitest";
import { isTruncatedJson, truncatedToolCallResult } from "./truncatedJson.js";

describe("isTruncatedJson", () => {
  test("a complete object is not truncated", () => {
    expect(isTruncatedJson('{"filepath":"a.ts","contents":"x"}')).toBe(false);
    expect(isTruncatedJson('{"a":[1,{"b":"}"}]}')).toBe(false);
    expect(isTruncatedJson("")).toBe(false);
  });

  test("arguments that stop inside a string or an open value are", () => {
    expect(isTruncatedJson('{"filepath":"a.ts","contents":"line 1\\nli')).toBe(
      true,
    );
    expect(isTruncatedJson('{"a":1,')).toBe(true);
    expect(isTruncatedJson('{"a":[1,2')).toBe(true);
  });

  test("braces and escaped quotes inside a string do not count", () => {
    expect(isTruncatedJson('{"c":"{{{ \\" ["}')).toBe(false);
    expect(isTruncatedJson('{"c":"a\\"')).toBe(true);
  });

  test("complete but malformed JSON is left to the lenient parser", () => {
    expect(isTruncatedJson('{"a":1,}')).toBe(false);
  });

  test("the message says nothing was written and how to go on", () => {
    const text = truncatedToolCallResult("create_new_file", 4096);
    expect(text).toContain("output limit of 4096 tokens");
    expect(text).toContain("nothing was written");
    expect(text).toContain("smaller pieces");
    expect(text).toContain("append set to true");
    expect(truncatedToolCallResult("multi_edit", undefined)).not.toContain(
      "append",
    );
  });
});
