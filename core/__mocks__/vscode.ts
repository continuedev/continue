/**
 * Mock VS Code API for testing LSP bridge
 */

export const Uri = {
  parse: jest.fn((filepath: string) => ({
    toString: () => filepath,
    fsPath: filepath,
    scheme: "file",
  })),
  file: jest.fn((path: string) => ({
    toString: () => path,
    fsPath: path,
    scheme: "file",
  })),
};

export const Position = jest.fn(function (line: number, character: number) {
  return { line, character };
});

export const Range = jest.fn(function (
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
) {
  return {
    start: { line: startLine, character: startCharacter },
    end: { line: endLine, character: endCharacter },
  };
});

export const commands = {
  executeCommand: jest.fn(),
  registerCommand: jest.fn(),
};

export const languages = {
  getDiagnostics: jest.fn(),
  registerCompletionItemProvider: jest.fn(),
};

export const window = {
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showInformationMessage: jest.fn(),
};

export const workspace = {
  getConfiguration: jest.fn(),
  workspaceFolders: [],
};

export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

export const SymbolKind = {
  File: 0,
  Module: 1,
  Namespace: 2,
  Package: 3,
  Class: 4,
  Method: 5,
  Property: 6,
  Field: 7,
  Constructor: 8,
  Enum: 9,
  Interface: 10,
  Function: 11,
  Variable: 12,
  Constant: 13,
  String: 14,
  Number: 15,
  Boolean: 16,
  Array: 17,
  Object: 18,
  Key: 19,
  Null: 20,
  EnumMember: 21,
  Struct: 22,
  Event: 23,
  Operator: 24,
  TypeParameter: 25,
};
