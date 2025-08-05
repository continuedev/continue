import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetLspDefinitionsFunction } from "../autocomplete/types.js";
import { HelperVars } from "../autocomplete/util/HelperVars.js";
import { ConfigHandler } from "../config/ConfigHandler.js";
import { IDE, ILLM } from "../index.js";
import { NextEditProvider } from "./NextEditProvider.js";

// Mock the countTokens function
vi.mock("../llm/countTokens.js", () => ({
  countTokens: (text: string) => {
    // Simple mock that counts 1 token per character for predictable tests
    return text.length;
  },
}));

// Create a helper function to set up the test context
function createMockHelper(
  fileContents: string,
  cursorLine: number,
): HelperVars {
  const fileLines = fileContents.split("\n");

  return {
    fileLines,
    fileContents,
    pos: { line: cursorLine, character: 0 },
    modelName: "gpt-4",
    lang: { name: "typescript" },
    filepath: "test/file.ts",
    workspaceUris: ["test/workspace"],
    options: {},
    input: { completionId: "test-completion-id" },
  } as unknown as HelperVars;
}

// TODO: Add more tests for other methods.
describe("_calculateOptimalEditableRegion", () => {
  let nextEditProvider: NextEditProvider;
  let mockConfigHandler: ConfigHandler;
  let mockIde: IDE;
  let mockGetLlm: () => Promise<ILLM | undefined>;
  let mockOnError: (e: any) => void;
  let mockGetDefinitionsFromLsp: GetLspDefinitionsFunction;

  beforeEach(() => {
    // Create comprehensive mocks for all dependencies
    mockConfigHandler = {
      loadConfig: vi.fn().mockResolvedValue({ config: {} }),
    } as unknown as ConfigHandler;

    mockIde = {
      readFile: vi.fn().mockResolvedValue(""),
      getWorkspaceDirs: vi.fn().mockResolvedValue([]),
      getRepoName: vi.fn().mockResolvedValue("test-repo"),
      getUniqueId: vi.fn().mockResolvedValue("test-id"),
      getIdeInfo: vi.fn().mockResolvedValue({ ideType: "vscode" }),
      onDidChangeActiveTextEditor: vi.fn().mockImplementation((callback) => {
        // Return a disposable object that does nothing when disposed
        return {
          dispose: () => {},
        };
      }),
    } as unknown as IDE;

    mockGetLlm = vi.fn().mockResolvedValue({
      model: "gpt-4",
      providerName: "openai",
      underlyingProviderName: "openai",
      completionOptions: {},
      chat: vi.fn(),
    });

    mockOnError = vi.fn();
    mockGetDefinitionsFromLsp = vi.fn();

    // Initialize NextEditProvider with mocked dependencies
    nextEditProvider = NextEditProvider.initialize(
      mockConfigHandler,
      mockIde,
      mockGetLlm,
      mockOnError,
      mockGetDefinitionsFromLsp,
      "default",
    );

    // Expose the private method for testing
    // This is a bit of a hack, but necessary for testing private methods
    (nextEditProvider as any)._calculateOptimalEditableRegion = (
      NextEditProvider.prototype as any
    )._calculateOptimalEditableRegion.bind(nextEditProvider);
  });

  // Test cases remain the same as before...
  it("should include only the cursor line when it already exceeds token limit", () => {
    // Create a mock helper with a very long cursor line (>500 characters)
    const longLine = "X".repeat(600);
    const helper = createMockHelper(longLine, 0);

    //@ts-ignore
    const result = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "tokenizer",
    );

    expect(result.editableRegionStartLine).toBe(0);
    expect(result.editableRegionEndLine).toBe(0);
  });

  it("should expand symmetrically when possible", () => {
    // Create content with identical lines and cursor in the middle
    const lines = Array(11).fill("A".repeat(40)).join("\n"); // 11 lines of 40 chars each
    const helper = createMockHelper(lines, 5); // Cursor in the middle (line 5)

    //@ts-ignore
    const result = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "tokenizer",
    );

    // Should expand 5 lines in each direction (total 11 lines) for symmetry
    expect(result.editableRegionStartLine).toBe(0);
    expect(result.editableRegionEndLine).toBe(10);
  });

  it("should expand asymmetrically when hitting a file boundary", () => {
    // Create content with cursor near the top
    const lines = Array(20).fill("B".repeat(20)).join("\n"); // 20 lines of 20 chars each
    const helper = createMockHelper(lines, 1); // Cursor near the top (line 1)

    //@ts-ignore
    const result = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "tokenizer",
    );

    // Should include more lines below since it can't expand much above
    expect(result.editableRegionStartLine).toBe(0);
    // Should include many more lines below to reach token limit
    expect(result.editableRegionEndLine).toBeGreaterThan(10);
  });

  it("should handle files with varying line lengths", () => {
    // Create content with varying line lengths
    const fileContents = [
      "Short line", // 10 chars
      "A".repeat(100), // 100 chars
      "Medium length line here", // 24 chars
      "B".repeat(200), // 200 chars
      "Another typical line of code", // 28 chars
    ].join("\n");

    const helper = createMockHelper(fileContents, 2); // Cursor on the medium line

    //@ts-ignore
    const result = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "tokenizer",
    );

    // Should include all lines since total tokens < 500
    expect(result.editableRegionStartLine).toBe(0);
    expect(result.editableRegionEndLine).toBe(4);
  });

  it("should respect the token limit and not include too many lines", () => {
    // Create content with many small lines (10 chars each)
    const lines = Array(600).fill("C".repeat(10)).join("\n");
    const helper = createMockHelper(lines, 300); // Cursor in the middle

    //@ts-ignore
    const result = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "tokenizer",
    );

    // Each line is 10 chars = 10 tokens per line with our mock.
    // So with 500 token limit, we should get 50 lines total.
    // 25 above, 25 below, +1 current
    const totalLines =
      result.editableRegionEndLine - result.editableRegionStartLine + 1;
    expect(totalLines).toBe(51); // Not more than 51 lines (25 above, 25 below, +1 for current line)
  });

  it("should use character approximation when using fourChars heuristic", () => {
    // In this test, we're setting up a situation where tiktoken and fourChars would give different results
    // Creating 5 lines, each 100 characters
    const lines = Array(10).fill("D".repeat(100)).join("\n");
    const helper = createMockHelper(lines, 2); // Cursor in the middle

    // Mock for tiktoken counting (1 char = 1 token)
    //@ts-ignore
    const tokenizerResult = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "tokenizer",
    );

    // Mock for fourChars counting (1 token = 4 chars)
    // This should include more lines since each line is counted as 25 tokens instead of 100
    //@ts-ignore
    const fourCharsResult = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "fourChars",
    );

    // The fourChars approach should include more lines since it estimates fewer tokens per line
    expect(
      fourCharsResult.editableRegionEndLine -
        fourCharsResult.editableRegionStartLine,
    ).toBeGreaterThan(
      tokenizerResult.editableRegionEndLine -
        tokenizerResult.editableRegionStartLine,
    );
  });

  it("should include the entire file if it's within token limit", () => {
    // Create a small file
    const smallFile = "Small file\nwith just\na few lines\nof text";
    const helper = createMockHelper(smallFile, 1);

    //@ts-ignore
    const result = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "tokenizer",
    );

    // Should include all lines
    expect(result.editableRegionStartLine).toBe(0);
    expect(result.editableRegionEndLine).toBe(3);
  });

  it("should prioritize balanced context when token limit allows", () => {
    // Create content with alternating long and short lines
    const fileContents = [
      "Short", // 5 chars
      "E".repeat(80), // 80 chars
      "Also short", // 10 chars
      "F".repeat(80), // 80 chars
      "Another short one", // 17 chars
      "G".repeat(80), // 80 chars
      "Final short line", // 16 chars
    ].join("\n");

    const helper = createMockHelper(fileContents, 3); // Cursor on the long line (index 3)

    //@ts-ignore
    const result = nextEditProvider._calculateOptimalEditableRegion(
      helper,
      "tokenizer",
    );

    // Should try to include equal number of lines above and below cursor
    const linesAbove = result.editableRegionStartLine;
    const linesBelow =
      helper.fileLines.length - 1 - result.editableRegionEndLine;

    // Difference between lines above and below should be minimal
    expect(Math.abs(linesAbove - linesBelow)).toBeLessThanOrEqual(1);
  });
});
