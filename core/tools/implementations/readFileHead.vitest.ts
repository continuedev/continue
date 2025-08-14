import { test, expect, vi } from "vitest";
import { getNumberArg } from "../parseArgs";

test("readFileHead validates input arguments", () => {
  // Test valid positive numbers
  expect(() => getNumberArg({ lines: 1 }, "lines")).not.toThrow();
  expect(() => getNumberArg({ lines: 10 }, "lines")).not.toThrow();
  expect(() => getNumberArg({ lines: "5" }, "lines")).not.toThrow();

  // Test missing arguments
  expect(() => getNumberArg({}, "lines")).toThrow(
    "Argument `lines` is required (type number)",
  );

  // Test invalid arguments
  expect(() => getNumberArg({ lines: "not-a-number" }, "lines")).toThrow(
    "Argument `lines` must be a valid number",
  );
  expect(() => getNumberArg({ lines: true }, "lines")).toThrow(
    "Argument `lines` must be a valid number",
  );
});

test("readFileHead handles line number conversion correctly", () => {
  // Test that parsing works for various inputs
  expect(getNumberArg({ lines: 1 }, "lines")).toBe(1);
  expect(getNumberArg({ lines: "10" }, "lines")).toBe(10);
  expect(getNumberArg({ lines: 5.7 }, "lines")).toBe(5); // Should floor
  expect(getNumberArg({ lines: "3.9" }, "lines")).toBe(3); // Should floor

  // Test that negative numbers are parsed (validation happens in implementation)
  expect(getNumberArg({ lines: -5 }, "lines")).toBe(-5);
});
