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
    nodeType: "function_declaration without return type",
    fileName: "functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 15, character: 58 },
    definitionPositions: [
      { row: 14, column: 33 }, // Person
    ],
  },
  {
    nodeType: "function_declaration without params",
    fileName: "functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 19, character: 70 },
    definitionPositions: [
      { row: 18, column: 39 }, // Person
    ],
  },
  {
    nodeType: "function_declaration with array params and array return type",
    fileName: "functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 23, character: 27 },
    definitionPositions: [
      { row: 22, column: 36 }, // Person
      { row: 22, column: 48 }, // Address
    ],
  },
  {
    nodeType:
      "function_declaration with generic params and generic return type",
    fileName: "functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 27, character: 14 },
    definitionPositions: [
      { row: 26, column: 44 }, // Person
      { row: 26, column: 52 }, // Address
      { row: 26, column: 62 }, // Person
      { row: 26, column: 70 }, // Address
    ],
  },
  {
    nodeType: "method_declaration with a param and a return type",
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
  {
    nodeType:
      "method_declaration with array type arguments and array type return",
    fileName: "class.ts",
    language: "TypeScript",
    cursorPosition: { line: 34, character: 50 },
    definitionPositions: [
      { row: 9, column: 29 }, // BaseClass
      { row: 9, column: 55 }, // FirstInterface
      { row: 9, column: 72 }, // SecondInterface
      { row: 33, column: 29 }, // Person
      { row: 33, column: 41 }, // Address
    ],
  },
];
