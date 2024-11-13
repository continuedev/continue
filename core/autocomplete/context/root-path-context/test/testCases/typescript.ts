export const TYPESCRIPT_TEST_CASES = [
  {
    nodeType: "function_declaration with a param and a return type",
    fileName: "functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 7, character: 24 },
    definitionPositions: [
      { row: 6, column: 34 }, // Person
      { row: 6, column: 44 }, // Address
    ],
  },
  {
    nodeType: "function_declaration with array param",
    fileName: "functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 11, character: 27 },
    definitionPositions: [
      { row: 10, column: 39 }, // Person
      { row: 10, column: 51 }, // Address
    ],
  },
  {
    nodeType: "method_declaration",
    fileName: "class.ts",
    language: "TypeScript",
    cursorPosition: { line: 18, character: 26 },
    definitionPositions: [
      { row: 9, column: 29 }, // BaseClass
      { row: 9, column: 55 }, // FirstInterface
      { row: 9, column: 72 }, // SecondInterface
      { row: 17, column: 33 }, // Person
      { row: 17, column: 43 }, // Address
    ],
  },
  {
    nodeType: "method_declaration without arguments",
    fileName: "class.ts",
    language: "TypeScript",
    cursorPosition: { line: 22, character: 54 },
    definitionPositions: [
      { row: 9, column: 29 }, // BaseClass
      { row: 9, column: 55 }, // FirstInterface
      { row: 9, column: 72 }, // SecondInterface
      { row: 21, column: 32 }, // Address
    ],
  },
  {
    nodeType: "method_declaration without return type",
    fileName: "class.ts",
    language: "TypeScript",
    cursorPosition: { line: 26, character: 43 },
    definitionPositions: [
      { row: 9, column: 29 }, // BaseClass
      { row: 9, column: 55 }, // FirstInterface
      { row: 9, column: 72 }, // SecondInterface
      { row: 25, column: 26 }, // Person
    ],
  },
  {
    nodeType: "method_declaration with array type arguments",
    fileName: "class.ts",
    language: "TypeScript",
    cursorPosition: { line: 30, character: 46 },
    definitionPositions: [
      { row: 9, column: 29 }, // BaseClass
      { row: 9, column: 55 }, // FirstInterface
      { row: 9, column: 72 }, // SecondInterface
      { row: 29, column: 26 }, // Person
    ],
  },
];
