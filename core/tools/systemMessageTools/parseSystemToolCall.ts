import { ToolCallDelta } from "../..";

const acceptableToolNameTags = ["tool_name:", "toolname:"];
const acceptableBeginArgTags = ["begin_arg:", "beginarg:"];
const acceptableEndArgTags = ["end_arg", "endarg"];

export type ToolCallParseState = {
  name: string;
  args: Map<string, string>;
  isOnArgBeginLine: boolean;
  currentArgName: string | undefined;
  currentArgContent: string;
  currentLineIndex: number;
  lineChunks: string[][];
  done: boolean;
  partialBuffer: string; // Buffer for handling partial tag matches
};

export const DEFAULT_TOOL_CALL_PARSE_STATE: ToolCallParseState = {
  name: "",
  args: new Map(),
  isOnArgBeginLine: false,
  currentArgName: undefined,
  currentArgContent: "",
  currentLineIndex: 0,
  lineChunks: [],
  done: false,
  partialBuffer: "",
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

function tryParseValue(value: string): any {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Try JSON parsing first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fallback to string
    return trimmed;
  }
}

function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
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
  // Skip the first chunk (```tool\n)
  if (state.currentLineIndex === 0) {
    state.currentLineIndex = 1;
    return;
  }

  // Handle newlines
  if (chunk === "\n") {
    // Process any buffered partial content
    if (state.partialBuffer) {
      const result = processBufferedContent(
        state.partialBuffer,
        toolCallId,
        state,
      );
      state.partialBuffer = "";
      state.currentLineIndex++;
      return result;
    }

    state.currentLineIndex++;

    // If we were on an arg begin line, we're now starting the arg content
    if (state.isOnArgBeginLine) {
      state.isOnArgBeginLine = false;
      if (!state.currentArgName) {
        throw new Error("Missing arg name in Begin arg line");
      }
      return createDelta("", '":"', toolCallId);
    }

    return;
  }

  // Add chunk to current line
  const lineIndex = state.currentLineIndex;
  if (!state.lineChunks[lineIndex]) {
    state.lineChunks[lineIndex] = [];
  }
  state.lineChunks[lineIndex].push(chunk);

  const currentLine = state.lineChunks[lineIndex].join("");
  const lowerCaseLine = currentLine.toLowerCase();

  // Check for partial matches that might prevent streaming
  const allTags = [
    "```",
    ...acceptableToolNameTags,
    ...acceptableBeginArgTags,
    ...acceptableEndArgTags,
  ];
  const hasPartialMatch = allTags.some(
    (tag) => tag.startsWith(lowerCaseLine) && tag !== lowerCaseLine,
  );

  if (hasPartialMatch) {
    state.partialBuffer += chunk;
    return; // Wait for more chunks
  }

  // If we had a partial buffer but no match, process it
  if (state.partialBuffer) {
    const result = processBufferedContent(
      state.partialBuffer,
      toolCallId,
      state,
    );
    state.partialBuffer = "";
    if (result) return result;
  }

  return processCurrentChunk(
    chunk,
    currentLine,
    lowerCaseLine,
    lineIndex,
    toolCallId,
    state,
  );
}

function processBufferedContent(
  bufferedContent: string,
  toolCallId: string,
  state: ToolCallParseState,
): ToolCallDelta | undefined {
  // If we're in an arg, treat buffered content as arg content
  if (state.currentArgName && !state.isOnArgBeginLine) {
    state.currentArgContent += bufferedContent;
    return createDelta("", escapeJsonString(bufferedContent), toolCallId);
  }

  // Otherwise, this was a false partial match, ignore it
  return;
}

function processCurrentChunk(
  chunk: string,
  currentLine: string,
  lowerCaseLine: string,
  lineIndex: number,
  toolCallId: string,
  state: ToolCallParseState,
): ToolCallDelta | undefined {
  // TOOL_NAME line (line 1)
  if (lineIndex === 1) {
    if (acceptableToolNameTags.some((tag) => lowerCaseLine.startsWith(tag))) {
      const nameMatch = currentLine.split(/tool_?name:\s*/i)[1] || "";
      if (nameMatch && !state.name) {
        state.name = nameMatch;
        return createDelta(nameMatch, "", toolCallId);
      } else if (nameMatch) {
        const newPart = nameMatch.slice(state.name.length);
        state.name = nameMatch;
        return createDelta(newPart, "", toolCallId);
      }
    }
    return;
  }

  // Check for end of tool call
  if (lowerCaseLine === "```") {
    // Close any open arg
    if (state.currentArgName) {
      const parsedValue = tryParseValue(state.currentArgContent);
      let jsonValue: string;

      if (typeof parsedValue === "string") {
        jsonValue = `"${escapeJsonString(parsedValue)}"`;
      } else {
        jsonValue = JSON.stringify(parsedValue);
      }

      const closingDelta =
        jsonValue.slice(state.currentArgContent.length) + "}";
      state.currentArgName = undefined;
      state.currentArgContent = "";
      state.done = true;
      return createDelta("", closingDelta, toolCallId);
    }

    // Close args object if we have any args
    if (state.args.size > 0) {
      state.done = true;
      return createDelta("", "}", toolCallId);
    }

    state.done = true;
    return;
  }

  // Check for BEGIN_ARG
  if (acceptableBeginArgTags.some((tag) => lowerCaseLine.startsWith(tag))) {
    state.isOnArgBeginLine = true;
    const argName = currentLine.split(/begin_?arg:\s*/i)[1]?.trim() || "";
    if (argName) {
      state.currentArgName = argName;
    }

    const prefix = state.args.size === 0 ? '{"' : ',"';
    const argNamePart = argName || "";
    state.args.set(argName, ""); // Mark that we've seen this arg

    return createDelta("", prefix + argNamePart, toolCallId);
  }

  // Check for END_ARG
  if (
    state.currentArgName &&
    acceptableEndArgTags.some((tag) => lowerCaseLine.startsWith(tag))
  ) {
    const parsedValue = tryParseValue(state.currentArgContent);
    let jsonValue: string;

    if (typeof parsedValue === "string") {
      jsonValue = `"${escapeJsonString(parsedValue)}"`;
    } else {
      jsonValue = JSON.stringify(parsedValue);
    }

    // Stream the remaining part of the JSON value
    const remainingJson = jsonValue.slice(state.currentArgContent.length);

    state.currentArgName = undefined;
    state.currentArgContent = "";

    return createDelta("", remainingJson, toolCallId);
  }

  // If we're in an arg (not on begin line), add to arg content
  if (state.currentArgName && !state.isOnArgBeginLine) {
    state.currentArgContent += chunk;
    return createDelta("", escapeJsonString(chunk), toolCallId);
  }

  // If we reach here and it's not an expected tag, it might be an error
  if (currentLine.trim() && !state.currentArgName && !state.isOnArgBeginLine) {
    throw new Error("Invalid/hanging line in tool call: " + currentLine);
  }

  return;
}
