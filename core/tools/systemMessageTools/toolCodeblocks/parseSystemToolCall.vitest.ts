import { beforeEach, describe, expect, it } from "vitest";
import { getInitialToolCallParseState, ToolCallParseState } from "../types";
import { handleToolCallBuffer } from "./parseSystemToolCall";

describe("handleToolCallBuffer", () => {
  let state: ToolCallParseState;

  beforeEach(() => {
    state = getInitialToolCallParseState();
  });

  it("handles the ```tool\ntool_name the name", () => {
    handleToolCallBuffer("```tool\ntool_name: my_name", state);
    expect(state.currentLineIndex).toBe(1);

    const result = handleToolCallBuffer("\n", state);
    expect(result).toEqual({
      type: "function",
      function: {
        name: "my_name",
        arguments: "",
      },
      id: expect.any(String),
    });
    expect(state.currentLineIndex).toBe(2);
  });

  it("handles the tool name line", () => {
    // Line 0 (```tool) is skipped internally
    state.currentLineIndex = 1;

    const result = handleToolCallBuffer("TOOL_NAME: test_tool", state);
    expect(result).toBeUndefined();

    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "test_tool",
        arguments: "",
      },
      id: expect.any(String),
    });
    expect(state.currentLineIndex).toBe(2);
  });

  it("handles case-insensitive tool name line", () => {
    state.currentLineIndex = 1;

    const result = handleToolCallBuffer("tool_name: test_tool", state);
    expect(result).toBeUndefined();

    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "test_tool",
        arguments: "",
      },
      id: expect.any(String),
    });
  });

  it("begins an argument correctly", () => {
    state.currentLineIndex = 2;

    const result = handleToolCallBuffer("BEGIN_ARG: test_arg", state);
    expect(result).toBeUndefined();
    expect(state.isWithinArgStart).toBe(true);

    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "",
        arguments: '{"test_arg":',
      },
      id: expect.any(String),
    });
    expect(state.currentArgName).toBe("test_arg");
    expect(state.isWithinArgStart).toBe(false);
  });

  it("handles case-insensitive begin arg", () => {
    state.currentLineIndex = 2;

    const result = handleToolCallBuffer("begin_arg: test_arg", state);
    expect(result).toBeUndefined();
    expect(state.isWithinArgStart).toBe(true);

    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "",
        arguments: '{"test_arg":',
      },
      id: expect.any(String),
    });
  });

  it("collects arg value lines", () => {
    state.currentLineIndex = 3;
    state.currentArgName = "test_arg";

    handleToolCallBuffer("line 1", state);
    const newLineResult1 = handleToolCallBuffer("\n", state);
    expect(newLineResult1).toBeUndefined();

    handleToolCallBuffer("line 2", state);
    const newLineResult2 = handleToolCallBuffer("\n", state);
    expect(newLineResult2).toBeUndefined();

    expect(state.currentArgChunks).toEqual(["line 1\n", "line 2\n"]);
  });

  it("ends an argument correctly with string value", () => {
    state.currentLineIndex = 3;
    state.currentArgName = "test_arg";
    state.currentArgChunks = ["string value"];

    const result = handleToolCallBuffer("END_ARG", state);
    expect(result).toBeUndefined();

    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "",
        arguments: '"string value"',
      },
      id: expect.any(String),
    });
    expect(state.currentArgName).toBeUndefined();
    expect(state.processedArgNames.has("test_arg")).toBe(true);
  });

  it("handles case-insensitive end arg", () => {
    state.currentLineIndex = 3;
    state.currentArgName = "test_arg";
    state.currentArgChunks = ["string value"];

    const result = handleToolCallBuffer("end_arg", state);
    expect(result).toBeUndefined();

    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "",
        arguments: '"string value"',
      },
      id: expect.any(String),
    });
  });

  it("attempts to parse JSON values", () => {
    state.currentLineIndex = 3;
    state.currentArgName = "test_arg";
    state.currentArgChunks = ["123"];

    handleToolCallBuffer("END_ARG", state);
    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "",
        arguments: "123",
      },
      id: expect.any(String),
    });
  });

  it("handles multiple arguments", () => {
    // Setup first arg
    state.currentLineIndex = 2;
    state.isWithinArgStart = true;
    state.lineChunks[2] = ["BEGIN_ARG: first_arg"];

    handleToolCallBuffer("\n", state);
    handleToolCallBuffer("value1", state);
    handleToolCallBuffer("\n", state);
    handleToolCallBuffer("END_ARG", state);
    handleToolCallBuffer("\n", state);

    expect(state.processedArgNames.has("first_arg")).toBe(true);

    // Setup second arg
    state.isWithinArgStart = true;
    handleToolCallBuffer("BEGIN_ARG: second_arg", state);
    handleToolCallBuffer("\n", state);
    handleToolCallBuffer("value2", state);
    handleToolCallBuffer("\n", state);
    handleToolCallBuffer("END_ARG", state);

    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "",
        arguments: '"value2"',
      },
      id: expect.any(String),
    });
    expect(state.processedArgNames.has("second_arg")).toBe(true);
  });

  it("finalizes JSON object at end of tool call", () => {
    state.currentLineIndex = 5;
    state.processedArgNames.add("test_arg");

    const result = handleToolCallBuffer("```", state);

    expect(result).toEqual({
      type: "function",
      function: {
        name: "",
        arguments: "}",
      },
      id: expect.any(String),
    });
    expect(state.done).toBe(true);
  });

  it("finalizes on newline after all args processed", () => {
    state.currentLineIndex = 5;
    state.processedArgNames.add("test_arg");

    const result = handleToolCallBuffer("\n", state);

    expect(result).toEqual({
      type: "function",
      function: {
        name: "",
        arguments: "}",
      },
      id: expect.any(String),
    });
    expect(state.done).toBe(true);
  });

  it("handles JSON array args", () => {
    state.currentLineIndex = 3;
    state.currentArgName = "test_arg";
    state.currentArgChunks = [
      "[\n",
      '"------- SEARCH\n',
      "  subtract(number) {\n",
      "    return this;\n",
      "  }\n",
      "=======\n",
      "  subtract(number) {\n",
      "    this -= number\n",
      "    return this;\n",
      "  }\n",
      '+++++++ REPLACE"\n',
      "]\n",
    ];

    handleToolCallBuffer("END_ARG", state);
    const newLineResult = handleToolCallBuffer("\n", state);

    expect(newLineResult).toEqual({
      type: "function",
      function: {
        name: "",
        arguments:
          '["------- SEARCH\\n  subtract(number) {\\n    return this;\\n  }\\n=======\\n  subtract(number) {\\n    this -= number\\n    return this;\\n  }\\n+++++++ REPLACE"]',
      },
      id: expect.any(String),
    });
  });
});
