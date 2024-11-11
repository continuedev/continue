import { testRootPathContext } from "./testUtils";

describe("RootPathContextService", () => {
  describe("TypeScript should return expected snippets when editing inside a:", () => {
    test("function", async () => {
      await testRootPathContext(
        "typescript",
        "file1.ts",
        { start: { line: 3, character: 2 }, end: { line: 3, character: 24 } },
        [
          { row: 2, column: 34 },
          { row: 2, column: 44 },
        ],
      );
    });

    test("class method", async () => {
      await testRootPathContext(
        "typescript",
        "file1.ts",
        { start: { line: 14, character: 4 }, end: { line: 14, character: 30 } },
        [
          { row: 13, column: 33 },
          { row: 13, column: 43 },
        ],
      );
    });
  });
});
