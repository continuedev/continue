import { ToolCallDelta } from "../..";

const acceptableToolNameTags = ["tool_name:", "toolname:"];
const acceptableBeginArgTags = ["begin_arg:", "beginarg:"];
const acceptableEndArgTags = ["end_arg", "endarg"];

export type ToolCallParseState = {
  name: string;
  args: Map<string, any>;
  isOnArgBeginLine: boolean;
  currentArgName: string | undefined;
  currentLineIndex: number;
  lineChunks: string[][];
  done: boolean;
};

export const DEFAULT_TOOL_CALL_PARSE_STATE: ToolCallParseState = {
  name: "",
  args: new Map(),
  isOnArgBeginLine: false,
  currentArgName: undefined,
  currentLineIndex: 0,
  lineChunks: [],
  done: false,
};

function createDelta(name: string, args: string, id: string): ToolCallDelta {
  return {
    type: "function",
    function: {
      name,
      arguments: args,
    },
    id,
  };
}

/*
  Efficiently applies chunks to a tool call state as they come in
  Expects chunks to be broken so that new lines and codeblocks are alone
*/
export function handleToolCallBuffer(
  chunk: string,
  toolCallId: string,
  state: ToolCallParseState,
): ToolCallDelta | undefined {
  // First, add the chunk to the line
  const lineIndex = state.currentLineIndex;
  const isOnArgBeginLine = state.isOnArgBeginLine;

  if (!state.lineChunks[lineIndex]) {
    state.lineChunks[lineIndex] = [];
  }
  state.lineChunks[lineIndex].push(chunk);

  // The first line will be skipped (```tool\n)
  if (lineIndex === 0) {
    state.currentLineIndex = 1;
    return;
  }

  // Increment line if relevant
  if (chunk === "\n") {
    state.currentLineIndex++;

    if (state.isOnArgBeginLine) {
      if (!state.currentArgName) {
        throw new Error("Missing arg name in Begin arg line");
      }
      state.isOnArgBeginLine = false;
      // Stream the Json chunk between arg and its value
      return createDelta("", '":', toolCallId);
    }
  }

  const currentLine = state.lineChunks[state.currentLineIndex].join("");
  const lowerCaseLine = currentLine.toLowerCase();

  // TOOL_NAME line
  if (lineIndex === 1) {
    if (state.name) {
      state.name += chunk;
      return createDelta(chunk, "", toolCallId);
    } else {
      if (acceptableToolNameTags.find((tag) => lowerCaseLine.startsWith(tag))) {
        const nameMatch = currentLine.split(/tool_?name:/i)[1] ?? "";
        state.name = nameMatch.trim();
        if (state.name) {
          return createDelta(state.name, "", toolCallId);
        }
      } else if (
        !acceptableToolNameTags.find((tag) => tag.startsWith(lowerCaseLine))
      ) {
        throw new Error("Invalid tool name line: " + currentLine);
      }
      return;
    }
  } else if (!state.name) {
    throw new Error("Missing tool call name");
    // BEGIN_ARG line
  } else if (isOnArgBeginLine) {
    state.currentArgName = (currentLine.split(/begin_?arg:/i)[1] ?? "").trim();
    return createDelta("", chunk, toolCallId);
  } else if (state.currentArgName) {
    // Check for escape from arg
    if (acceptableEndArgTags.find((tag) => lowerCaseLine.startsWith(tag))) {
      state.currentArgName = undefined;
    }
    // Check for partial escape from arg
    else if (
      acceptableEndArgTags.find((tag) => tag.startsWith(lowerCaseLine))
    ) {
      return;
    }

    const currentVal = state.args.get(state.currentArgName!);
    const argsDelta = `${currentVal ? '"' : ""}${chunk}`;
    if (currentVal) {
      state.args.set(state.currentArgName!, currentVal + chunk);
      return createDelta("", chunk, toolCallId);
    } else {
      state.args.set(state.currentArgName!, chunk);
      return createDelta("", `"${chunk}`, toolCallId);
    }
    // // Add chunk to arg
    // else if (state.currentArgName) {
    //         if (state.currentArgName) {
    //     const endValue = state.args.get(state.currentArgName);
    //     if (!endValue) {
    //       state.args.set(state.currentArgName, "");
    //     } else if (endValue.toLowerCase() === "false") {
    //       state.args.set(state.currentArgName, false);
    //     } else if (endValue.toLowerCase() === "true") {
    //       state.args.set(state.currentArgName, true);
    //     } else {
    //       const num = Number(endValue);
    //       if (!isNaN(num)) {
    //         state.args.set(state.currentArgName, num);
    //       }
    //     }
    //   }
    // }
  } else {
    // If not in arg, check for closing tags
    if (lowerCaseLine === "```" || lowerCaseLine === "\n") {
      // On completion, finish args JSON if applicable
      if (state.args.size > 0) {
        return createDelta("", '"}', toolCallId);
      }
      state.done = true;
      return;
    }
    // Check for begin arg tags
    if (acceptableBeginArgTags.find((tag) => lowerCaseLine.startsWith(tag))) {
      state.isOnArgBeginLine = true;
      const argName = (currentLine.split(/begin_?arg:/i)[1] ?? "").trim();
      if (argName) {
        state.currentArgName = argName;
      }
      const argDelta = `${state.args.size === 0 ? "{" : ","}"${argName}`;
      return createDelta("", argDelta, toolCallId);
    }
    // Handle partial begin/close tags
    if (
      lowerCaseLine &&
      ["```", ...acceptableBeginArgTags].some((v) =>
        v.startsWith(lowerCaseLine),
      )
    ) {
      return;
    }
    throw new Error("Invalid/hanging line in tool call:\n" + lowerCaseLine);
  }
}
