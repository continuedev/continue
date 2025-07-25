let boundaryTypeIndex = 0;

// Poor models are really bad at following instructions
// Give some leeway in how the initiate
const acceptedToolStarts: [string, string][] = [
  ["```tool\n", "```tool\n"],
  ["tool_name:", "```tool\nTOOL_NAME:"],
];

export function detectToolCallStart(buffer: string) {
  let modifiedBuffer = buffer;
  let isInToolCall = false;
  let isInPartialStart = false;
  const lowerCaseBuffer = buffer.toLowerCase();
  for (let i = 0; i < acceptedToolStarts.length; i++) {
    const [start, replacement] = acceptedToolStarts[i];
    if (lowerCaseBuffer.startsWith(start)) {
      // for non-standard cases like no ```tool codeblock, etc, replace before adding to buffer, case insensitive
      if (i !== 0) {
        modifiedBuffer = buffer.replace(new RegExp(start, "i"), replacement);
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
