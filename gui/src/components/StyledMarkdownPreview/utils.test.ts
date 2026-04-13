import {
  isTerminalCodeBlock,
  childrenToText,
  matchCodeToSymbolOrFile,
  isSymbolNotRif,
} from "./utils";
import { RangeInFileWithContents, SymbolWithRange } from "core";

describe("isTerminalCodeBlock", () => {
  describe("when language is a terminal language", () => {
    it("should return true for bash language", () => {
      expect(isTerminalCodeBlock("bash", "any command")).toBe(true);
    });

    it("should return true for sh language", () => {
      expect(isTerminalCodeBlock("sh", "any command")).toBe(true);
    });
  });

  describe("when language is not specified or empty", () => {
    it("should return true for npm commands", () => {
      expect(isTerminalCodeBlock("", "npm install lodash")).toBe(true);
      expect(isTerminalCodeBlock(undefined, "npm install lodash")).toBe(true);
      expect(isTerminalCodeBlock(null, "npm install lodash")).toBe(true);
    });

    it("should return true for pnpm commands", () => {
      expect(isTerminalCodeBlock("", "pnpm add lodash")).toBe(true);
    });

    it("should return true for yarn commands", () => {
      expect(isTerminalCodeBlock("", "yarn add lodash")).toBe(true);
    });

    it("should return true for git commands", () => {
      expect(isTerminalCodeBlock("", "git status")).toBe(true);
    });

    it("should return true for pip commands", () => {
      expect(isTerminalCodeBlock("", "pip install requests")).toBe(true);
    });

    it("should return true for python commands", () => {
      expect(isTerminalCodeBlock("", "python script.py")).toBe(true);
    });

    it("should return true for cd commands", () => {
      expect(isTerminalCodeBlock("", "cd /path/to/dir")).toBe(true);
    });

    it("should return true for ls commands", () => {
      expect(isTerminalCodeBlock("", "ls -la")).toBe(true);
    });

    it("should return true for curl commands", () => {
      expect(isTerminalCodeBlock("", "curl https://example.com")).toBe(true);
    });

    it("should return true for single-line text without language", () => {
      expect(isTerminalCodeBlock("", "some single line command")).toBe(true);
    });

    it("should return false for multi-line text that does not start with a command", () => {
      expect(isTerminalCodeBlock("", "const x = 1;\nconst y = 2;")).toBe(false);
    });
  });

  describe("when language is specified but not terminal", () => {
    it("should return false for javascript", () => {
      expect(isTerminalCodeBlock("javascript", "npm install")).toBe(false);
    });

    it("should return false for python language even with python command", () => {
      expect(isTerminalCodeBlock("python", "python script.py")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle whitespace-only text", () => {
      expect(isTerminalCodeBlock("", "   ")).toBe(true); // Single line after trim
    });

    it("should handle bun commands", () => {
      expect(isTerminalCodeBlock("", "bun install")).toBe(true);
    });

    it("should handle deno commands", () => {
      expect(isTerminalCodeBlock("", "deno run script.ts")).toBe(true);
    });

    it("should handle npx commands", () => {
      expect(isTerminalCodeBlock("", "npx create-react-app my-app")).toBe(true);
    });

    it("should handle pwd commands", () => {
      expect(isTerminalCodeBlock("", "pwd")).toBe(true);
    });

    it("should handle node commands", () => {
      expect(isTerminalCodeBlock("", "node server.js")).toBe(true);
    });

    it("should handle wget commands", () => {
      expect(isTerminalCodeBlock("", "wget https://example.com/file")).toBe(
        true,
      );
    });

    it("should handle rbenv commands", () => {
      expect(isTerminalCodeBlock("", "rbenv install 3.0.0")).toBe(true);
    });

    it("should handle gem commands", () => {
      expect(isTerminalCodeBlock("", "gem install rails")).toBe(true);
    });

    it("should handle ruby commands", () => {
      expect(isTerminalCodeBlock("", "ruby script.rb")).toBe(true);
    });

    it("should handle bundle commands", () => {
      expect(isTerminalCodeBlock("", "bundle install")).toBe(true);
    });
  });
});

describe("childrenToText", () => {
  it("should handle string children", () => {
    expect(childrenToText(["hello", " ", "world"])).toBe("hello world");
  });

  it("should handle empty array", () => {
    expect(childrenToText([])).toBe("");
  });

  it("should handle nested objects with props.children", () => {
    const children = [
      { props: { children: "hello" } },
      " ",
      { props: { children: "world" } },
    ];
    expect(childrenToText(children)).toBe("hello world");
  });

  it("should handle deeply nested children", () => {
    const children = [{ props: { children: { props: { children: "deep" } } } }];
    expect(childrenToText(children)).toBe("deep");
  });

  it("should handle array children within objects", () => {
    const children = [{ props: { children: ["a", "b", "c"] } }];
    expect(childrenToText(children)).toBe("abc");
  });

  it("should handle mixed content", () => {
    const children = ["text", { props: { children: "child" } }, ["arr", "ay"]];
    expect(childrenToText(children)).toBe("textchildarray");
  });

  it("should handle null/undefined values", () => {
    const children = ["hello", null, undefined, "world"];
    expect(childrenToText(children)).toBe("helloworld");
  });

  it("should return empty string for objects without props", () => {
    const children = [{ notProps: "value" }];
    expect(childrenToText(children)).toBe("");
  });
});

describe("matchCodeToSymbolOrFile", () => {
  const mockSymbols: SymbolWithRange[] = [
    {
      name: "calculateSum",
      type: "function",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 5, character: 0 },
      },
      filepath: "/src/utils.ts",
      content: "function calculateSum() {}",
    },
    {
      name: "MyClass",
      type: "class",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 20, character: 0 },
      },
      filepath: "/src/myClass.ts",
      content: "class MyClass {}",
    },
  ];

  const mockRifs: RangeInFileWithContents[] = [
    {
      filepath: "/src/utils.ts",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 10, character: 0 },
      },
      contents: "file contents",
    },
    {
      filepath: "/src/components/Button.tsx",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 20, character: 0 },
      },
      contents: "button component",
    },
  ];

  describe("file matching", () => {
    it("should match file by exact filename", () => {
      const result = matchCodeToSymbolOrFile("utils.ts", mockSymbols, mockRifs);
      expect(result).toEqual(mockRifs[0]);
    });

    it("should match file with longer path by last segment", () => {
      const result = matchCodeToSymbolOrFile(
        "Button.tsx",
        mockSymbols,
        mockRifs,
      );
      expect(result).toEqual(mockRifs[1]);
    });

    it("should not match file for content without dot", () => {
      const result = matchCodeToSymbolOrFile("utils", mockSymbols, mockRifs);
      expect(result).not.toEqual(mockRifs[0]);
    });

    it("should not match file for content with less than 3 characters", () => {
      const result = matchCodeToSymbolOrFile("a.b", [], mockRifs);
      expect(result).toBeUndefined();
    });
  });

  describe("symbol matching", () => {
    it("should match symbol by exact name", () => {
      const result = matchCodeToSymbolOrFile("calculateSum", mockSymbols, []);
      expect(result).toEqual(mockSymbols[0]);
    });

    it("should match symbol by partial name (function with parameters)", () => {
      const result = matchCodeToSymbolOrFile(
        "calculateSum(a, b)",
        mockSymbols,
        [],
      );
      expect(result).toEqual(mockSymbols[0]);
    });

    it("should return undefined when no match found", () => {
      const result = matchCodeToSymbolOrFile(
        "nonexistent",
        mockSymbols,
        mockRifs,
      );
      expect(result).toBeUndefined();
    });
  });

  describe("priority", () => {
    it("should prefer file match over symbol match when both exist", () => {
      const symbolsWithFileName: SymbolWithRange[] = [
        {
          name: "utils.ts",
          type: "variable",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
          filepath: "/src/index.ts",
          content: "const utils.ts = 1",
        },
      ];
      const result = matchCodeToSymbolOrFile(
        "utils.ts",
        symbolsWithFileName,
        mockRifs,
      );
      expect(result).toEqual(mockRifs[0]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty arrays", () => {
      const result = matchCodeToSymbolOrFile("something", [], []);
      expect(result).toBeUndefined();
    });

    it("should handle empty content", () => {
      const result = matchCodeToSymbolOrFile("", mockSymbols, mockRifs);
      expect(result).toBeUndefined();
    });
  });
});

describe("isSymbolNotRif", () => {
  it("should return true for SymbolWithRange", () => {
    const symbol: SymbolWithRange = {
      name: "myFunction",
      type: "function",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 5, character: 0 },
      },
      filepath: "/src/file.ts",
      content: "function myFunction() {}",
    };
    expect(isSymbolNotRif(symbol)).toBe(true);
  });

  it("should return false for RangeInFileWithContents", () => {
    const rif: RangeInFileWithContents = {
      filepath: "/src/file.ts",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 10, character: 0 },
      },
      contents: "file contents",
    };
    expect(isSymbolNotRif(rif)).toBe(false);
  });
});
