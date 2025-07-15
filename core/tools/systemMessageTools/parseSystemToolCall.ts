import { ToolCallDelta } from "../..";

const acceptableToolNameTags = ["tool_name:", "toolname:"];
const acceptableBeginArgTags = ["begin_arg", "beginarg"];
const acceptableEndArgTags = ["end_arg", "endarg"];

export type ToolCallParseState = {
  name: string;
  args: Record<string, any>;
  isInArg: boolean;
  currentArgName: string | undefined;
  currentLineIndex: number;
  currentLine: string;
  done: boolean;
};

export const DEFAULT_TOOL_CALL_PARSE_STATE: ToolCallParseState = {
  name: "",
  args: {},
  isInArg: false,
  currentArgName: undefined,
  currentLineIndex: 0,
  currentLine: "",
  done: false,
};

type ParseToolCallOutput = {
  delta: ToolCallDelta | undefined;
  done: boolean;
};

const NO_OUTPUT: ParseToolCallOutput = {
  delta: undefined,
  done: false,
};

export function handleToolCallBuffer(
  chunk: string,
  toolCallId: string,
  state: ToolCallParseState,
): ParseToolCallOutput {
  if (chunk === "\n") {
    state.currentLineIndex++;
    state.currentLine = "";
  } else {
    state.currentLine += chunk;
  }
  const lowerCaseLine = state.currentLine.toLowerCase();

  if (state.currentLineIndex === 0) {
    return NO_OUTPUT;
  }
  debugger;
  if (state.currentLineIndex === 1) {
    if (acceptableToolNameTags.find((tag) => lowerCaseLine.startsWith(tag))) {
      state.name = (state.currentLine.split(/tool_?name:/i)[1] ?? "").trim();
    }
    if (acceptableToolNameTags.find((tag) => tag.startsWith(lowerCaseLine))) {
      return NO_OUTPUT;
    }
  } else if (state.isInArg) {
    if (acceptableEndArgTags.find((tag) => lowerCaseLine.startsWith(tag))) {
      if (state.currentArgName) {
        const endValue = state.args[state.currentArgName];
        if (!endValue) {
          state.args[state.currentArgName] = "";
        } else if (endValue.toLowerCase() === "false") {
          state.args[state.currentArgName] = false;
        } else if (endValue.toLowerCase() === "true") {
          state.args[state.currentArgName] = true;
        } else {
          const num = Number(endValue);
          if (!isNaN(num)) {
            state.args[state.currentArgName] = num;
          }
        }
      }
      state.isInArg = false;
      state.currentArgName = undefined;
    } else if (
      acceptableEndArgTags.find((tag) => tag.startsWith(lowerCaseLine))
    ) {
      return NO_OUTPUT;
    } else if (state.currentArgName) {
      if (state.args[state.currentArgName]) {
        state.args[state.currentArgName] += chunk;
      } else {
        state.args[state.currentArgName] = chunk;
      }
    }
  } else if (
    acceptableBeginArgTags.find((tag) => lowerCaseLine.startsWith(tag))
  ) {
    const argName = (state.currentLine.split(/begin_?arg:/i)[1] ?? "").trim();
    if (argName) {
      state.isInArg = true;
      state.currentArgName = argName;
    }
  } else if (state.currentLine === "```") {
    state.done = true;
  } else if (
    ["```", ...acceptableBeginArgTags].some((v) => v.startsWith(lowerCaseLine))
  ) {
    return NO_OUTPUT;
  } else {
    throw new Error("Invalid/hanging line in tool call:\n" + state.currentLine);
  }

  if (state.done) {
    if (!state.name) {
      throw new Error("Invalid tool name found in call");
    }

    const result: ParseToolCallOutput = {
      done: state.done,
      delta: {
        type: "function",
        function: {
          arguments: JSON.stringify(state.args),
          name: state.name,
        },
        id: toolCallId,
      },
    };

    return result;
  }

  if (!state.name) {
    return {
      done: false,
      delta: undefined,
    };
  }

  return {
    done: state.done,
    delta: {
      type: "function",
      function: {
        arguments: JSON.stringify(state.args),
        name: state.name,
      },
      id: toolCallId,
    },
  };
}
