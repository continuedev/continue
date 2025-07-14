let boundaryTypeIndex = 0;

// Poor models are really bad at following instructions
// Here are some examples of what they often start the tool call with
const acceptedToolStarts: [string, string][] = [
  ["```tool\n", "```tool\n"],
  ["tool_name:", "```tool\ntool_name:"],
  // ["<tool_call>", "<tool_call>"],
  // ["<tool_call>", "<tool_call>"],
  // ["```xml\n<tool_call>", "<tool_call>"],
  // ["```\n<tool_call>", "<tool_call>"],
  // ["```tool_call>\n", "<tool_call>"],
  // ["```tool_call\n", "<tool_call>"],
  // ["```xml\n<tool_name>", "<tool_call>\n<tool_name>"],
  // ["\n\n<tool_name>", "<tool_call>\n<tool_name>"],
  // ["```xml\n<name>", "<tool_call>\n<name>"],
];

export function detectToolCallStart(buffer: string) {
  let modifiedBuffer = buffer;
  let isInToolCall = false;
  let isInPartialStart = false;
  const lowerCaseBuffer = buffer.toLowerCase();
  for (let i = 0; i < acceptedToolStarts.length; i++) {
    const [start, _] = acceptedToolStarts[i];
    if (lowerCaseBuffer.startsWith(start)) {
      boundaryTypeIndex = i;
      // for non-standard cases like no ```tool codeblock, etc, replace before adding to buffer, case insensitive
      if (boundaryTypeIndex !== 0) {
        modifiedBuffer = buffer.replace(
          new RegExp(start, "i"),
          acceptedToolStarts[boundaryTypeIndex][1],
        );
      }
      isInToolCall = true;
      break;
    } else if (start.startsWith(lowerCaseBuffer)) {
      isInPartialStart = true;
    }
  }
  return {
    isInToolCall,
    isInPartialStart,
    modifiedBuffer,
  };
}

const acceptedToolEnds = ["END_ARG\n```", ""];

// export function detectToolCallEnd(toolCallText: string): {
//   hasEnd: boolean
//   extraText?: string
// } {

// const END_TAG = "END_ARG\n```";
//             const endTagIdx = toolCallText.indexOf(END_TAG);
//             if (endTagIdx !== -1) {
//               leaveToolCall()
//               done = true;
//               // buffer = toolCallText.slice(endTagIdx + END_TAG.length)
//             }
// return {
//   hasEnd: false
// }
// }
