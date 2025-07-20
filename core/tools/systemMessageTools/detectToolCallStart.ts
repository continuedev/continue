let boundaryTypeIndex = 0;

// Poor models are really bad at following instructions
// Give some leeway in how the initiate
const acceptedToolStarts: [string, string][] = [
  ["```tool\n", "```tool\n"],
  ["tool_name:", "```tool\ntool_name:"],
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
