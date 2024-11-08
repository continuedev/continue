import { testRootPathContext } from "./testUtils";

describe("RootPathContextService", () => {
  describe("TypeScript should return expected snippets when editing inside a:", () => {
    test("function", async () => {
      await testRootPathContext(
        "typescript",
        "file1.ts",
        { start: { line: 3, character: 2 }, end: { line: 3, character: 24 } },
        ["EXPECTED SNIPPET 1", "EXPECTED SNIPPET 2"],
      );
    });

    test("class method", async () => {
      await testRootPathContext(
        "typescript",
        "file1.ts",
        { start: { line: 14, character: 4 }, end: { line: 14, character: 30 } },
        ["EXPECTED SNIPPET 1", "EXPECTED SNIPPET 2"],
      );
    });
  });
});
