import { describe, expect, it, vi } from "vitest";

import type { IDE, Problem, RangeInFile } from "../..";
import { newProblems, newProblemsItem } from "../problemsReport";
import {
  codeNavigationImpl,
  formatOutline,
  formatProblems,
  formatSymbols,
  kindName,
  locateSymbol,
} from "./codeNavigation";

// core's SymbolKind values (declared in index.d.ts, so not importable at runtime)
const SymbolKind = { Class: 4, Method: 5, Function: 11, Variable: 12 } as const;

const WS = "file:///work";
const range = (line: number, character = 0, endLine = line) => ({
  start: { line, character },
  end: { line: endLine, character: character + 1 },
});

const APP = [
  'import { loadConfig } from "./config";', // 1
  "",
  "export function main() {", // 3
  "  const config = loadConfig();", // 4
  "  return config.name;", // 5
  "}",
].join("\n");
const CONFIG = [
  "export interface Config {", // 1
  "  name: string;",
  "}",
  "",
  "export function loadConfig(): Config {", // 5
  '  return { name: "x" };',
  "}",
].join("\n");

function fakeIde(overrides: Partial<IDE> = {}): IDE {
  const files: Record<string, string> = {
    [`${WS}/src/app.ts`]: APP,
    [`${WS}/src/config.ts`]: CONFIG,
  };
  return {
    getWorkspaceDirs: vi.fn(async () => [WS]),
    fileExists: vi.fn(async (uri: string) => uri in files),
    readFile: vi.fn(async (uri: string) => files[uri] ?? ""),
    gotoDefinition: vi.fn(async () => [
      { filepath: `${WS}/src/config.ts`, range: range(4, 16, 6) },
    ]),
    gotoTypeDefinition: vi.fn(async () => [
      { filepath: `${WS}/src/config.ts`, range: range(0, 17, 2) },
    ]),
    getReferences: vi.fn(async (): Promise<RangeInFile[]> => [
      { filepath: `${WS}/src/app.ts`, range: range(0, 9) },
      { filepath: `${WS}/src/app.ts`, range: range(3, 17) },
      { filepath: `${WS}/src/config.ts`, range: range(4, 16) },
    ]),
    getDocumentSymbols: vi.fn(async () => [
      {
        name: "main",
        kind: SymbolKind.Function,
        range: range(2, 0, 5),
        selectionRange: range(2, 16),
      },
      {
        name: "config",
        kind: SymbolKind.Variable,
        range: range(3, 8),
        selectionRange: range(3, 8),
      },
    ]),
    getWorkspaceSymbols: vi.fn(async () => [
      {
        name: "loadConfig",
        kind: SymbolKind.Function,
        location: { filepath: `${WS}/src/config.ts`, range: range(4, 16) },
      },
    ]),
    getProblems: vi.fn(async (): Promise<Problem[]> => []),
    ...overrides,
  } as unknown as IDE;
}

const run = async (args: Record<string, unknown>, ide = fakeIde()) =>
  (await codeNavigationImpl(args, { ide } as any))[0].content;

describe("locateSymbol", () => {
  it("finds the first whole-word occurrence, 0-based", () => {
    expect(locateSymbol(APP, "loadConfig")).toEqual({ line: 0, character: 9 });
    // "config" the variable, not the "config" inside "loadConfig" or "./config"
    expect(locateSymbol(APP, "config", 4)).toEqual({ line: 3, character: 8 });
  });

  it("prefers the given 1-based line, and tolerates being one off", () => {
    expect(locateSymbol(APP, "loadConfig", 4)).toEqual({
      line: 3,
      character: 17,
    });
    expect(locateSymbol(APP, "loadConfig", 5)).toEqual({
      line: 3,
      character: 17,
    });
  });

  it("returns undefined for a name that is not there", () => {
    expect(locateSymbol(APP, "nothing")).toBeUndefined();
  });

  it("matches qualified names literally", () => {
    expect(locateSymbol(APP, "config.name")).toEqual({
      line: 4,
      character: 9,
    });
  });
});

describe("formatters", () => {
  it("names symbol kinds", () => {
    expect(kindName(SymbolKind.Class)).toBe("class");
    expect(kindName(999)).toBe("symbol");
  });

  it("puts exact symbol matches first, with relative paths", () => {
    const text = formatSymbols(
      [
        {
          name: "loadConfigFile",
          kind: SymbolKind.Function,
          location: { filepath: `${WS}/a.ts`, range: range(9) },
        },
        {
          name: "loadConfig",
          kind: SymbolKind.Function,
          containerName: "Loader",
          location: { filepath: `${WS}/src/b.ts`, range: range(1) },
        },
      ],
      "loadConfig",
      [WS],
    );
    const lines = text.split("\n");
    expect(lines[1]).toBe("- loadConfig (function in Loader) src/b.ts:2");
    expect(lines[2]).toBe("- loadConfigFile (function) a.ts:10");
  });

  it("nests the outline by range", () => {
    const text = formatOutline(
      [
        {
          name: "Foo",
          kind: SymbolKind.Class,
          range: range(0, 0, 10),
          selectionRange: range(0, 6),
        },
        {
          name: "bar",
          kind: SymbolKind.Method,
          range: range(2, 2, 4),
          selectionRange: range(2, 2),
        },
        {
          name: "baz",
          kind: SymbolKind.Function,
          range: range(12, 0, 14),
          selectionRange: range(12, 9),
        },
      ],
      "src/foo.ts",
    );
    expect(text.split("\n").slice(1)).toEqual([
      "1: class Foo",
      "  3: method bar",
      "13: function baz",
    ]);
  });

  it("lists errors before warnings", () => {
    const text = formatProblems(
      [
        {
          filepath: `${WS}/x.ts`,
          range: range(1, 4),
          message: "unused",
          severity: "warning",
        },
        {
          filepath: `${WS}/x.ts`,
          range: range(5, 2),
          message: "type mismatch",
          severity: "error",
          source: "ts",
        },
      ],
      "x.ts",
      [WS],
    );
    expect(text.split("\n").slice(1)).toEqual([
      "x.ts:6:3 error [ts]: type mismatch",
      "x.ts:2:5 warning: unused",
    ]);
  });
});

describe("codeNavigationImpl", () => {
  it("symbols: searches the workspace", async () => {
    expect(await run({ operation: "symbols", symbol: "loadConfig" })).toContain(
      "- loadConfig (function) src/config.ts:5",
    );
  });

  it("definition: asks at the symbol's position and shows the code", async () => {
    const ide = fakeIde();
    const text = await run(
      {
        operation: "definition",
        filepath: "src/app.ts",
        symbol: "loadConfig",
        line: 4,
      },
      ide,
    );
    expect(ide.gotoDefinition).toHaveBeenCalledWith({
      filepath: `${WS}/src/app.ts`,
      position: { line: 3, character: 17 },
    });
    expect(text).toContain("src/config.ts:5");
    expect(text).toContain("5| export function loadConfig(): Config {");
    expect(text).toContain("7| }");
  });

  it("type_definition uses the type provider", async () => {
    const ide = fakeIde();
    const text = await run(
      {
        operation: "type_definition",
        filepath: "src/app.ts",
        symbol: "config",
      },
      ide,
    );
    expect(ide.gotoTypeDefinition).toHaveBeenCalled();
    expect(text).toContain("1| export interface Config {");
  });

  it("references: one line each, with the code, and a count", async () => {
    const text = await run({
      operation: "references",
      filepath: "src/config.ts",
      symbol: "loadConfig",
    });
    expect(text).toContain("3 references to loadConfig in 2 files");
    expect(text).toContain("src/app.ts:4: const config = loadConfig();");
  });

  it("outline and problems take a file", async () => {
    expect(
      await run({ operation: "outline", filepath: "src/app.ts" }),
    ).toContain("3: function main");
    expect(await run({ operation: "problems", filepath: "src/app.ts" })).toBe(
      "No problems reported in src/app.ts.",
    );
  });

  it("explains an empty answer instead of failing", async () => {
    const ide = fakeIde({ gotoDefinition: vi.fn(async () => []) });
    expect(
      await run(
        { operation: "definition", filepath: "src/app.ts", symbol: "main" },
        ide,
      ),
    ).toContain("try grep_search");
  });

  it("rejects a missing file, an absent symbol and an unknown operation", async () => {
    await expect(
      run({ operation: "outline", filepath: "src/nope.ts" }),
    ).rejects.toThrow(/does not exist/);
    await expect(
      run({ operation: "definition", filepath: "src/app.ts", symbol: "nope" }),
    ).rejects.toThrow(/does not appear/);
    await expect(run({ operation: "rename" })).rejects.toThrow(
      /Unknown operation/,
    );
  });
});

describe("problems after an edit", () => {
  const p = (
    message: string,
    line: number,
    severity?: Problem["severity"],
  ) => ({
    filepath: `${WS}/x.ts`,
    range: range(line),
    message,
    severity,
  });

  it("reports only problems the edit added, ignoring moved ones", () => {
    const before = [p("old error", 3, "error"), p("hint", 1, "hint")];
    const after = [
      p("old error", 9, "error"), // moved down by the edit: not new
      p("new error", 4, "error"),
      p("new hint", 2, "hint"), // hints are not reported
      p("new warning", 5, "warning"),
    ];
    expect(newProblems(before, after).map((x) => x.message)).toEqual([
      "new error",
      "new warning",
    ]);
  });

  it("counts duplicates: a second copy of an old message is new", () => {
    const before = [p("x", 1, "error")];
    const after = [p("x", 1, "error"), p("x", 7, "error")];
    expect(newProblems(before, after)).toHaveLength(1);
  });

  it("formats them for the agent, errors first", () => {
    const item = newProblemsItem("src/x.ts", [
      p("unused", 5, "warning"),
      p("bad type", 9, "error"),
    ]);
    expect(item?.content).toContain("2 new problems in src/x.ts (1 error)");
    expect(item?.content.indexOf("bad type")).toBeLessThan(
      item?.content.indexOf("unused") ?? 0,
    );
    expect(newProblemsItem("src/x.ts", [])).toBeUndefined();
  });
});
