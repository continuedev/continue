import { expect, test, vi } from "vitest";

import { ToolExtras } from "../..";

import { grepSearchImpl } from "./grepSearch";

function extrasReturning(results: string) {
  return {
    fetch: vi.fn() as any,
    ide: {
      getSearchResults: vi.fn().mockResolvedValue(results),
    } as any,
  } as unknown as ToolExtras;
}

// ripgrep is run with `.` as the search root, so `--heading` echoes that root
// back using the platform separator: `./path` on POSIX, `.\path` on Windows.
const posixResults = "./src/calc.ts\n  subtract(n) {\n    return this;";
const windowsResults = ".\\src\\calc.ts\n  subtract(n) {\n    return this;";

test("returns results for POSIX-style headings", async () => {
  const result = await grepSearchImpl(
    { query: "subtract" },
    extrasReturning(posixResults),
  );

  expect(result).toHaveLength(1);
  expect(result[0].content).toContain("subtract(n) {");
});

test("returns results for Windows-style headings", async () => {
  // The reported bug: ripgrep found the match, but no heading was recognised,
  // so numResults stayed 0 and the tool answered "no results" with the content
  // sitting right there in its hand.
  const result = await grepSearchImpl(
    { query: "subtract" },
    extrasReturning(windowsResults),
  );

  expect(result).toHaveLength(1);
  expect(result[0].content).not.toBe("The search returned no results.");
  expect(result[0].content).toContain("subtract(n) {");
});

test("splits Windows results per file and normalises the URI separators", async () => {
  const result = await grepSearchImpl(
    { query: "subtract", splitByFile: true },
    extrasReturning(
      `${windowsResults}\n.\\test.py\n  def subtract(self):\n    pass`,
    ),
  );

  expect(result).toHaveLength(2);
  // Forward slashes, even though ripgrep reported backslashes: this value is a
  // `file` context-item URI, and those get glob-matched to decide which rules
  // apply — and in a glob a backslash escapes the next character rather than
  // separating path segments, so `src\calc.ts` would match nothing.
  expect(result[0].uri).toEqual({ type: "file", value: "src/calc.ts" });
  expect(result[1].uri).toEqual({ type: "file", value: "test.py" });
  // The heading line itself is stripped from each chunk's content.
  expect(result[0].content).toBe("subtract(n) {\n    return this;");
  expect(result[1].content).toBe("def subtract(self):\n    pass");
});

test("splits POSIX results per file", async () => {
  const result = await grepSearchImpl(
    { query: "subtract", splitByFile: true },
    extrasReturning(
      `${posixResults}\n./test.py\n  def subtract(self):\n    pass`,
    ),
  );

  expect(result).toHaveLength(2);
  expect(result[0].uri).toEqual({ type: "file", value: "src/calc.ts" });
  expect(result[1].uri).toEqual({ type: "file", value: "test.py" });
});

test("still reports genuinely empty searches as empty", async () => {
  const result = await grepSearchImpl(
    { query: "nothing" },
    extrasReturning(""),
  );

  expect(result).toHaveLength(1);
  expect(result[0].content).toBe("The search returned no results.");
});
