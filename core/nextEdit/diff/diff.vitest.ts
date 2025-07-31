import { describe, expect, it } from "vitest";
import { checkFim } from "./diff";

describe("checkFim", () => {
  const testCases = [
    {
      name: "simple insertion at cursor",
      oldEditRange: ["function test() {", "  ", "}"].join("\n"),
      newEditRange: ["function test() {", "  console.log('hello');", "}"].join(
        "\n",
      ),
      cursorPosition: { line: 1, character: 2 },
      expected: {
        isFim: true,
        fimText: "console.log('hello');",
      },
    },
    {
      name: "not a FIM because insertion starts before { and new suffix is different from {}",
      oldEditRange: ["function test() {}"].join("\n"),
      newEditRange: ["function test() {console.log('test');}"].join("\n"),
      cursorPosition: { line: 0, character: 16 },
      expected: {
        isFim: false,
        fimText: null,
      },
    },
    {
      name: "insertion with cursor at beginning",
      oldEditRange: ["function test() {}"].join("\n"),
      newEditRange: ["function test() {console.log('test');}"].join("\n"),
      cursorPosition: { line: 0, character: 17 },
      expected: {
        isFim: true,
        fimText: "console.log('test');",
      },
    },
    {
      name: "not a FIM because text was deleted",
      oldEditRange: ["function test() {", "  return 42;", "}"].join("\n"),
      newEditRange: ["function test() {", "  console.log('hello');", "}"].join(
        "\n",
      ),
      cursorPosition: { line: 1, character: 2 },
      expected: {
        isFim: false,
        fimText: null,
      },
    },
    {
      name: "not a FIM because text was changed before cursor",
      oldEditRange: ["let x = 1;"].join("\n"),
      newEditRange: ["const x = 1; // initialized x"].join("\n"),
      cursorPosition: { line: 0, character: 8 },
      expected: {
        isFim: false,
        fimText: null,
      },
    },
    {
      name: "multi-line insertion at cursor",
      oldEditRange: [
        "function process() {",
        "  ",
        "  return result;",
        "}",
      ].join("\n"),
      newEditRange: [
        "function process() {",
        "  const data = fetchData();",
        "  const result = processData(data);",
        "  return result;",
        "}",
      ].join("\n"),
      cursorPosition: { line: 1, character: 2 },
      expected: {
        isFim: true,
        fimText:
          "const data = fetchData();\n  const result = processData(data);",
      },
    },
    {
      name: "interesting case",
      oldEditRange: ["  }", "}", ""].join("\n"),
      newEditRange: ["  }", "}", "", "module.exports = Calculator;"].join("\n"),
      cursorPosition: { line: 0, character: 0 },
      expected: {
        isFim: false,
        fimText: null,
      },
    },
    {
      name: "calculator.js divide",
      oldEditRange: [
        "    ",
        "    if (number === 0) {",
        '      throw new Error("Cannot divide by zero");',
        "    }",
        "    this.result /= number;",
        "    return this;",
      ].join("\n"),
      newEditRange: [
        "    if (typeof number !== 'number') {",
        '      throw new Error("Invalid input: must be a number");',
        "    }",
        "    if (number === 0) {",
        '      throw new Error("Cannot divide by zero");',
        "    }",
        "    this.result /= number;",
        "    return this;",
      ].join("\n"),
      cursorPosition: { line: 0, character: 4 },
      expected: {
        isFim: true,
        fimText: [
          "if (typeof number !== 'number') {",
          '      throw new Error("Invalid input: must be a number");',
          "    }",
        ].join("\n"),
      },
    },
  ];

  testCases.forEach(
    ({ name, oldEditRange, newEditRange, cursorPosition, expected }) => {
      it(name, () => {
        const result = checkFim(oldEditRange, newEditRange, cursorPosition);
        expect(result).toEqual(expected);
      });
    },
  );
});
