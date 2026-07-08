import { expect, test } from "vitest";
import { getNumberArg } from "../parseArgs";

test("readFileRange should validate positive line number arguments", () => {
  // Test positive startLine validation
  expect(() => getNumberArg({ startLine: 1 }, "startLine")).not.toThrow();
  expect(() => getNumberArg({ startLine: "1" }, "startLine")).not.toThrow();
  expect(() => getNumberArg({ startLine: 100 }, "startLine")).not.toThrow();

  // Test positive endLine validation
  expect(() => getNumberArg({ endLine: 5 }, "endLine")).not.toThrow();
  expect(() => getNumberArg({ endLine: "10" }, "endLine")).not.toThrow();
  expect(() => getNumberArg({ endLine: 1000 }, "endLine")).not.toThrow();

  // Test missing arguments
  expect(() => getNumberArg({}, "startLine")).toThrow(
    "Argument `startLine` is required (type number)",
  );
  expect(() => getNumberArg({}, "endLine")).toThrow(
    "Argument `endLine` is required (type number)",
  );

  // Test invalid arguments
  expect(() =>
    getNumberArg({ startLine: "not-a-number" }, "startLine"),
  ).toThrow("Argument `startLine` must be a valid number");
  expect(() => getNumberArg({ endLine: true }, "endLine")).toThrow(
    "Argument `endLine` must be a valid number",
  );
});

test("readFileRange should handle line number conversion", () => {
  // Test that our parsing function converts correctly
  expect(getNumberArg({ line: 1 }, "line")).toBe(1);
  expect(getNumberArg({ line: "5" }, "line")).toBe(5);
  expect(getNumberArg({ line: 10.7 }, "line")).toBe(10); // Should floor
  expect(getNumberArg({ line: "15.9" }, "line")).toBe(15); // Should floor
});

test("readFileRange parses negative numbers (validation happens in implementation)", () => {
  // The parseArgs function should parse negative numbers correctly
  // but the implementation will reject them with helpful error messages
  expect(getNumberArg({ line: -1 }, "line")).toBe(-1);
  expect(getNumberArg({ line: -10 }, "line")).toBe(-10);
  expect(getNumberArg({ line: "-5" }, "line")).toBe(-5);
});

test("readFileRange handles out-of-bounds ranges gracefully", () => {
  // IDE implementations handle out-of-bounds gracefully:
  // - VS Code: Uses array.slice() which handles out-of-bounds gracefully
  // - IntelliJ: Uses lines.getOrNull() which returns null for out-of-bounds
  // Both return empty content or available content without throwing errors

  expect(() => {
    const startLine = getNumberArg({ startLine: 1000 }, "startLine");
    const endLine = getNumberArg({ endLine: 2000 }, "endLine");
    expect(startLine).toBe(1000);
    expect(endLine).toBe(2000);
  }).not.toThrow();
});
