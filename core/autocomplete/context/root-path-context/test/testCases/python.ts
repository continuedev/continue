export const FUNCTIONS = [
  {
    nodeType: "function_definition with argument and return type",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 15, character: 8 },
    definitionPositions: [
      { row: 14, column: 30 }, // Person
      { row: 14, column: 42 }, // Address
    ],
  },
  {
    nodeType:
      "function_definition with generic argument and generic return type",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 18, character: 8 },
    definitionPositions: [
      { row: 17, column: 35 }, // Group
      { row: 17, column: 42 }, // Person
      { row: 17, column: 53 }, // Group
      { row: 17, column: 61 }, // Address
    ],
  },
  {
    nodeType: "function_definition with single argument and None return type",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 21, character: 8 },
    definitionPositions: [
      { row: 20, column: 29 }, // Person
    ],
  },
  {
    nodeType: "function_definition with no arguments and single return type",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 24, character: 8 },
    definitionPositions: [
      { row: 23, column: 38 }, // Address
    ],
  },
  {
    nodeType: "function_definition with Union arguments and Union return type",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 27, character: 8 },
    definitionPositions: [
      { row: 26, column: 45 }, // Person
      { row: 26, column: 54 }, // Address
      { row: 26, column: 72 }, // Person
      { row: 26, column: 81 }, // Address
    ],
  },
  {
    nodeType:
      "function_definition with multiple arguments and None return type",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 30, character: 8 },
    definitionPositions: [
      { row: 29, column: 41 }, // Person
      { row: 29, column: 59 }, // Address
    ],
  },
  {
    nodeType: "function_definition with one argument and Generator return type",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 33, character: 9 },
    definitionPositions: [
      { row: 32, column: 40 }, // Person
      { row: 32, column: 62 }, // Address
    ],
  },
  {
    nodeType: "function_definition inside a class",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 38, character: 12 },
    definitionPositions: [
      { row: 37, column: 51 }, // Person
      { row: 37, column: 69 }, // Address
    ],
  },
  {
    nodeType: "function_definition of an async function",
    fileName: "python/functions.py",
    language: "Python",
    cursorPosition: { line: 41, character: 8 },
    definitionPositions: [
      { row: 40, column: 37 }, // Address
      { row: 40, column: 48 }, // Person
    ],
  },
];

export const CLASSES = [
  {
    nodeType: "class_definition with multiple superclasses",
    fileName: "python/classes.py",
    language: "Python",
    cursorPosition: { line: 1, character: 8 },
    definitionPositions: [
      { row: 0, column: 21 }, // BaseClass
      { row: 0, column: 29 }, // Person
    ],
  },
  {
    nodeType: "class_definition with multiple superclasses",
    fileName: "python/classes.py",
    language: "Python",
    cursorPosition: { line: 4, character: 8 },
    definitionPositions: [
      { row: 3, column: 31 }, // MetaGroup
    ],
  },
  {
    nodeType: "class_definition with generic superclasses",
    fileName: "python/classes.py",
    language: "Python",
    cursorPosition: { line: 7, character: 8 },
    definitionPositions: [
      { row: 6, column: 21 }, // BaseClass
      { row: 6, column: 29 }, // Address
      { row: 6, column: 41 }, // Gathering
      { row: 6, column: 48 }, // Person
    ],
  },
  {
    nodeType: "class_definition with generic superclasses (built in types)",
    fileName: "python/classes.py",
    language: "Python",
    cursorPosition: { line: 10, character: 8 },
    definitionPositions: [
      { row: 9, column: 24 }, // Address
      { row: 9, column: 33 }, // Person
    ],
  },
];

export const PYTHON_TEST_CASES = [
  // ...FUNCTIONS,
  ...CLASSES,
];
