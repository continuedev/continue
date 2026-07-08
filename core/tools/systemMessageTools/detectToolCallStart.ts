import { SystemMessageToolsFramework } from "./types";

export function detectToolCallStart(
  buffer: string,
  toolCallFramework: SystemMessageToolsFramework,
) {
  const starts = toolCallFramework.acceptedToolCallStarts;
  let modifiedBuffer = buffer;
  let isInToolCall = false;
  let isInPartialStart = false;
  const lowerCaseBuffer = buffer.toLowerCase();
  for (let i = 0; i < starts.length; i++) {
    const [start, replacement] = starts[i];
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
