import { ToolCallDelta } from "../..";
import { createDelta, generateOpenAIToolCallId } from "./systemToolUtils";

export type ToolCallParseState = {
  toolCallId: string;
  isOnArgBeginLine: boolean;
  currentArgName: string | undefined;
  currentArgLines: string[];
  processedArgNames: Set<string>;
  currentLineIndex: number;
  lineChunks: string[][];
  done: boolean;
};

export const getInitialTooLCallParseState = (): ToolCallParseState => ({
  toolCallId: generateOpenAIToolCallId(),
  isOnArgBeginLine: false,
  currentArgName: undefined,
  currentArgLines: [],
  currentLineIndex: 0,
  processedArgNames: new Set(),
  lineChunks: [],
  done: false,
});

/*
  Efficiently applies chunks to a tool call state as they come in
  Expects chunks to be broken so that new lines and codeblocks are alone
  For now, this parser collects entire arg before
  This is because support for JSON booleans is tricky otherwise

*/
export function handleToolCallBuffer(
  chunk: string,
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
      // non-standard start sequences will sometimes include stuff in the tool_name line
      const splitBuffer = line.split("\n");
      if (splitBuffer[0]) {
        state.lineChunks[0] = [splitBuffer[0], "\n"];
      }
      if (splitBuffer[1]) {
        state.lineChunks[1] = [splitBuffer[1]];
      }

      state.currentLineIndex = 1;
    // Tool name line - process once line 2 is reached
    case 1:
      if (isNewLine) {
        const name = (line.split(/tool_?name:/i)[1] ?? "").trim();
        if (!name) {
          throw new Error("Invalid tool name");
        }
        return createDelta(name, "", state.toolCallId);
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
          return createDelta("", `${argPrefix}"${argName}":`, state.toolCallId);
        }
      } else if (state.currentArgName) {
        if (isNewLine) {
          const isEndArgTag = line.match(/end_?arg/i);
          if (isEndArgTag) {
            let trimmedValue = state.currentArgLines.join("").trim();
            state.currentArgLines.length = 0;
            state.processedArgNames.add(state.currentArgName);
            state.currentArgName = undefined;

            try {
              if (
                trimmedValue.startsWith("[") ||
                trimmedValue.startsWith("{")
              ) {
                trimmedValue = trimmedValue.replace(
                  /"((?:\\[\s\S]|[^"\\])*?)"/g,
                  (match) => {
                    const content = match.slice(1, -1);
                    // Replace unescaped newlines
                    return (
                      '"' +
                      content
                        .replace(/([^\\])\n/g, "$1\\n")
                        .replace(/^\n/g, "\\n") +
                      '"'
                    );
                  },
                );
              }
              const parsed = JSON.parse(trimmedValue);
              const stringifiedArg = JSON.stringify(parsed);
              return createDelta("", stringifiedArg, state.toolCallId);
            } catch (e) {
              const stringifiedArg = JSON.stringify(trimmedValue);
              return createDelta("", stringifiedArg, state.toolCallId);
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
            return createDelta("", "}", state.toolCallId);
          }
        }
      }
  }
}
