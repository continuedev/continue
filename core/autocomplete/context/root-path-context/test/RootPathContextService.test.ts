import { testRootPathContext } from "./testUtils";

const TEST_CASES = [
  {
    description: "function",
    fileName: "file1.ts",
    range: {
      start: { line: 10, character: 2 },
      end: { line: 10, character: 24 },
    },
    positions: [
      { row: 9, column: 34 }, // Person
      { row: 9, column: 44 }, // Address
    ],
  },
  {
    description: "class method",
    fileName: "file1.ts",
    range: {
      start: { line: 22, character: 4 },
      end: { line: 22, character: 30 },
    },
    positions: [
      { row: 13, column: 29 }, // BaseClass
      { row: 13, column: 55 }, // FirstInterface
      { row: 13, column: 72 }, // SecondInterface
      { row: 21, column: 33 }, // Person
      { row: 21, column: 43 }, // Address
    ],
  },
];

describe("RootPathContextService", () => {
  describe("TypeScript should return expected snippets when editing inside a:", () => {
    test.each(TEST_CASES)(
      "should look for correct type definitions when editing inside a $description",
      async ({ fileName, range, positions }) => {
        await testRootPathContext("typescript", fileName, range, positions);
      },
    );
  });
});
