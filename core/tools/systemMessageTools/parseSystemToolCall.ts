import { ToolCallDelta } from "../..";

export type ToolCallParseState = {
  isOnArgBeginLine: boolean;
  currentArgName: string | undefined;
  currentArgLines: string[];
  processedArgNames: Set<string>;
  currentLineIndex: number;
  lineChunks: string[][];
  done: boolean;
};

export const getInitialTooLCallParseState = (): ToolCallParseState => ({
  isOnArgBeginLine: false,
  currentArgName: undefined,
  currentArgLines: [],
  currentLineIndex: 0,
  processedArgNames: new Set(),
  lineChunks: [],
  done: false,
});

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
  For now, this parser collects entire arg before
  This is because support for JSON booleans is tricky otherwise

*/
export function handleToolCallBuffer(
  chunk: string,
  toolCallId: string,
  state: ToolCallParseState,
): ToolCallDelta | undefined {
  // Add chunks
  const lineIndex = state.currentLineIndex;
  if (!state.lineChunks[lineIndex]) {
    state.lineChunks[lineIndex] = [];
  }
  state.lineChunks[lineIndex].push(chunk);

  const isNewLine = chunk === "\n";
  if (isNewLine) {
    state.currentLineIndex++;
  }

  const line = state.lineChunks[lineIndex].join("");

  switch (lineIndex) {
    // The first line will be skipped (e.g. ```tool\n)
    case 0:
      state.currentLineIndex = 1;
      if (!line.toLowerCase().includes("name")) {
        return;
      }
    // tool_name alternate start case
    // Tool name line - process once line 2 is reached
    case 1:
      if (isNewLine) {
        const name = (line.split(/tool_?name:/i)[1] ?? "").trim();
        if (!name) {
          throw new Error("Invalid tool name");
        }
        return createDelta(name, "", toolCallId);
      }
      return;
    default:
      if (state.isOnArgBeginLine) {
        if (isNewLine) {
          const argName = (line.split(/begin_?arg:/i)[1] ?? "").trim();
          if (!argName) {
            throw new Error("Invalid begin arg line");
          }
          state.currentArgName = argName;
          state.isOnArgBeginLine = false;
          const argPrefix = state.processedArgNames.size === 0 ? "{" : ",";
          return createDelta("", `${argPrefix}"${argName}":`, toolCallId);
        }
      } else if (state.currentArgName) {
        if (isNewLine) {
          const isEndArgTag = line.match(/end_?arg/i);
          if (isEndArgTag) {
            const trimmedValue = state.currentArgLines.join("").trim();
            state.currentArgLines.length = 0;
            state.processedArgNames.add(state.currentArgName);
            state.currentArgName = undefined;

            try {
              const parsed = JSON.parse(trimmedValue);
              const stringifiedArg = JSON.stringify(parsed);
              return createDelta("", stringifiedArg, toolCallId);
            } catch (e) {
              const stringifiedArg = JSON.stringify(trimmedValue);
              return createDelta("", stringifiedArg, toolCallId);
            }
          } else {
            state.currentArgLines.push(line);
          }
        }
      } else {
        // Check for entry into arg
        const isBeginArgLine = line.match(/begin_?arg:/i);
        if (isBeginArgLine) {
          state.isOnArgBeginLine = true;
        }

        // Check for exit
        if (line === "```" || isNewLine) {
          state.done = true;
          // finish args JSON if applicable
          if (state.processedArgNames.size > 0) {
            return createDelta("", "}", toolCallId);
          }
        }
      }
  }
}
