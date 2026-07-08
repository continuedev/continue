const FUNCTIONS = [
  {
    nodeType: "function_declaration with a param and a return type",
    fileName: "typescript/functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 3, character: 9 },
    definitionPositions: [
      { row: 2, column: 34 }, // Person
      { row: 2, column: 44 }, // Address
    ],
  },
  {
    nodeType: "function_declaration with array param",
    fileName: "typescript/functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 7, character: 9 },
    definitionPositions: [
      { row: 6, column: 39 }, // Person
      { row: 6, column: 51 }, // Address
    ],
  },
  {
    nodeType: "function_declaration without return type",
    fileName: "typescript/functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 11, character: 9 },
    definitionPositions: [
      { row: 10, column: 33 }, // Person
    ],
  },
  {
    nodeType: "function_declaration without params",
    fileName: "typescript/functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 15, character: 9 },
    definitionPositions: [
      { row: 14, column: 39 }, // Person
    ],
  },
  {
    nodeType: "function_declaration with array params and array return type",
    fileName: "typescript/functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 19, character: 9 },
    definitionPositions: [
      { row: 18, column: 36 }, // Person
      { row: 18, column: 48 }, // Address
    ],
  },
  {
    nodeType:
      "function_declaration with generic params and generic return type",
    fileName: "typescript/functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 23, character: 9 },
    definitionPositions: [
      { row: 22, column: 44 }, // Person
      { row: 22, column: 52 }, // Address
      { row: 22, column: 62 }, // Person
      { row: 22, column: 70 }, // Address
    ],
  },
  {
    nodeType:
      "function_declaration with union type params and union return type",
    fileName: "typescript/functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 27, character: 9 },
    definitionPositions: [
      { row: 26, column: 42 }, // Person
      { row: 26, column: 52 }, // Address
      { row: 26, column: 61 }, // Person
      { row: 26, column: 71 }, // Address
    ],
  },
  {
    nodeType: "function_declaration with two arguments",
    fileName: "typescript/functions.ts",
    language: "TypeScript",
    cursorPosition: { line: 31, character: 9 },
    definitionPositions: [
      { row: 30, column: 43 }, // Person
      { row: 30, column: 61 }, // Address
    ],
  },
];

const GENERATORS = [
  {
    nodeType: "function_declaration with a param and a return type",
    fileName: "typescript/generators.ts",
    language: "TypeScript",
    cursorPosition: { line: 3, character: 9 },
    definitionPositions: [
      { row: 2, column: 35 }, // Person
      { row: 2, column: 45 }, // Address
    ],
  },
  {
    nodeType: "function_declaration with array param",
    fileName: "typescript/generators.ts",
    language: "TypeScript",
    cursorPosition: { line: 7, character: 9 },
    definitionPositions: [
      { row: 6, column: 40 }, // Person
      { row: 6, column: 52 }, // Address
    ],
  },
  {
    nodeType: "function_declaration without return type",
    fileName: "typescript/generators.ts",
    language: "TypeScript",
    cursorPosition: { line: 11, character: 9 },
    definitionPositions: [
      { row: 10, column: 34 }, // Person
    ],
  },
  {
    nodeType: "function_declaration without params",
    fileName: "typescript/generators.ts",
    language: "TypeScript",
    cursorPosition: { line: 15, character: 9 },
    definitionPositions: [
      { row: 14, column: 40 }, // Person
    ],
  },
  {
    nodeType: "function_declaration with array params and array return type",
    fileName: "typescript/generators.ts",
    language: "TypeScript",
    cursorPosition: { line: 19, character: 9 },
    definitionPositions: [
      { row: 18, column: 37 }, // Person
      { row: 18, column: 49 }, // Address
    ],
  },
  {
    nodeType:
      "function_declaration with generic params and generic return type",
    fileName: "typescript/generators.ts",
    language: "TypeScript",
    cursorPosition: { line: 23, character: 9 },
    definitionPositions: [
      { row: 22, column: 45 }, // Person
      { row: 22, column: 53 }, // Address
      { row: 22, column: 63 }, // Person
      { row: 22, column: 71 }, // Address
    ],
  },
  {
    nodeType:
      "function_declaration with union type params and union return type",
    fileName: "typescript/generators.ts",
    language: "TypeScript",
    cursorPosition: { line: 27, character: 9 },
    definitionPositions: [
      { row: 26, column: 43 }, // Person
      { row: 26, column: 53 }, // Address
      { row: 26, column: 62 }, // Person
      { row: 26, column: 72 }, // Address
    ],
  },
  {
    nodeType: "function_declaration with two arguments",
    fileName: "typescript/generators.ts",
    language: "TypeScript",
    cursorPosition: { line: 31, character: 9 },
    definitionPositions: [
      { row: 30, column: 44 }, // Person
      { row: 30, column: 62 }, // Address
    ],
  },
];

const ARROW_FUNCTIONS = [
  {
    nodeType: "arrow_function with a param and a return type",
    fileName: "typescript/arrowFunctions.ts",
    language: "TypeScript",
    cursorPosition: { line: 3, character: 9 },
    definitionPositions: [
      { row: 2, column: 34 }, // Person
      { row: 2, column: 44 }, // Address
    ],
  },
  {
    nodeType: "arrow_function without return type",
    fileName: "typescript/arrowFunctions.ts",
    language: "TypeScript",
    cursorPosition: { line: 7, character: 9 },
    definitionPositions: [
      { row: 6, column: 33 }, // Person
    ],
  },
  {
    nodeType: "arrow_function without params",
    fileName: "typescript/arrowFunctions.ts",
    language: "TypeScript",
    cursorPosition: { line: 11, character: 9 },
    definitionPositions: [
      { row: 10, column: 39 }, // Person
    ],
  },
  {
    nodeType: "arrow_function with array params and array return type",
    fileName: "typescript/arrowFunctions.ts",
    language: "TypeScript",
    cursorPosition: { line: 15, character: 9 },
    definitionPositions: [
      { row: 14, column: 36 }, // Person
      { row: 14, column: 48 }, // Address
    ],
  },
  {
    nodeType: "arrow_function with generic params and generic return type",
    fileName: "typescript/arrowFunctions.ts",
    language: "TypeScript",
    cursorPosition: { line: 19, character: 9 },
    definitionPositions: [
      { row: 18, column: 43 }, // Person
      { row: 18, column: 51 }, // Address
      { row: 18, column: 61 }, // Person
      { row: 18, column: 69 }, // Address
    ],
  },
  {
    nodeType: "arrow_function with union type params and union return type",
    fileName: "typescript/arrowFunctions.ts",
    language: "TypeScript",
    cursorPosition: { line: 23, character: 9 },
    definitionPositions: [
      { row: 22, column: 42 }, // Person
      { row: 22, column: 52 }, // Address
      { row: 22, column: 61 }, // Person
      { row: 22, column: 71 }, // Address
    ],
  },
  {
    nodeType: "arrow_function with two arguments",
    fileName: "typescript/arrowFunctions.ts",
    language: "TypeScript",
    cursorPosition: { line: 27, character: 11 },
    definitionPositions: [
      { row: 26, column: 43 }, // Person
      { row: 26, column: 61 }, // Address
    ],
  },
];

const CLASS_METHODS = [
  {
    nodeType: "method_declaration with a param and a return type",
    fileName: "typescript/classMethods.ts",
    language: "TypeScript",
    cursorPosition: { line: 4, character: 11 },
    definitionPositions: [
      { row: 3, column: 33 }, // Person
      { row: 3, column: 43 }, // Address
    ],
  },
  {
    nodeType: "method_declaration without arguments",
    fileName: "typescript/classMethods.ts",
    language: "TypeScript",
    cursorPosition: { line: 8, character: 11 },
    definitionPositions: [
      { row: 7, column: 32 }, // Address
    ],
  },
  {
    nodeType: "method_declaration without return type",
    fileName: "typescript/classMethods.ts",
    language: "TypeScript",
    cursorPosition: { line: 12, character: 11 },
    definitionPositions: [
      { row: 11, column: 26 }, // Person
    ],
  },
  {
    nodeType: "method_declaration with array type arguments",
    fileName: "typescript/classMethods.ts",
    language: "TypeScript",
    cursorPosition: { line: 16, character: 11 },
    definitionPositions: [
      { row: 15, column: 26 }, // Person
    ],
  },
  {
    nodeType:
      "method_declaration with array type arguments and array type return",
    fileName: "typescript/classMethods.ts",
    language: "TypeScript",
    cursorPosition: { line: 20, character: 11 },
    definitionPositions: [
      { row: 19, column: 29 }, // Person
      { row: 19, column: 41 }, // Address
    ],
  },
  {
    nodeType:
      "method_declaration with with generic params and generic return type",
    fileName: "typescript/classMethods.ts",
    language: "TypeScript",
    cursorPosition: { line: 24, character: 11 },
    definitionPositions: [
      { row: 23, column: 37 }, // Person
      { row: 23, column: 45 }, // Address
      { row: 23, column: 55 }, // Person
      { row: 23, column: 63 }, // Address
    ],
  },
  {
    nodeType: "method_declaration with union type params and union return type",
    fileName: "typescript/classMethods.ts",
    language: "TypeScript",
    cursorPosition: { line: 28, character: 11 },
    definitionPositions: [
      { row: 27, column: 35 }, // Person
      { row: 27, column: 45 }, // Address
      { row: 27, column: 54 }, // Person
      { row: 27, column: 64 }, // Address
    ],
  },
  {
    nodeType: "method_declaration with two arguments",
    fileName: "typescript/classMethods.ts",
    language: "TypeScript",
    cursorPosition: { line: 32, character: 11 },
    definitionPositions: [
      { row: 31, column: 36 }, // Person
      { row: 31, column: 54 }, // Address
    ],
  },
];

const CLASS_DEFINITIONS = [
  {
    nodeType: "class_declaration with base class",
    fileName: "typescript/classes.ts",
    language: "TypeScript",
    cursorPosition: { line: 2, character: 31 },
    definitionPositions: [
      { row: 2, column: 29 }, // BaseClass
    ],
  },
  {
    nodeType: "class_declaration with interface",
    fileName: "typescript/classes.ts",
    language: "TypeScript",
    cursorPosition: { line: 4, character: 39 },
    definitionPositions: [
      { row: 4, column: 37 }, // FirstInterface
    ],
  },
  {
    nodeType: "class_declaration with base class and multiple interfaces",
    fileName: "typescript/classes.ts",
    language: "TypeScript",
    cursorPosition: { line: 6, character: 74 },
    definitionPositions: [
      { row: 6, column: 29 }, // BaseClass
      { row: 6, column: 55 }, // FirstInterface
      { row: 6, column: 72 }, // SecondInterface
    ],
  },
  {
    nodeType: "class_declaration with base class and multiple interfaces",
    fileName: "typescript/classes.ts",
    language: "TypeScript",
    cursorPosition: { line: 6, character: 74 },
    definitionPositions: [
      { row: 6, column: 29 }, // BaseClass
      { row: 6, column: 55 }, // FirstInterface
      { row: 6, column: 72 }, // SecondInterface
    ],
  },
  {
    nodeType: "class_declaration with generic base class and generic interface",
    fileName: "typescript/classes.ts",
    language: "TypeScript",
    cursorPosition: { line: 8, character: 69 },
    definitionPositions: [
      { row: 8, column: 29 }, // BaseClass
      { row: 8, column: 61 }, // FirstInterface
      { row: 8, column: 34 }, // User
      { row: 8, column: 66 }, // User
    ],
  },
];

export const TYPESCRIPT_TEST_CASES = [
  ...FUNCTIONS,
  ...GENERATORS,
  ...ARROW_FUNCTIONS,
  ...CLASS_METHODS,
  ...CLASS_DEFINITIONS,
];
