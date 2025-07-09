let boundaryTypeIndex = 0;

// Poor models are really bad at following instructions
// Here are some examples of what they often start the tool call with
const acceptedBoundaries: [string, string][] = [
  ["<tool_call>", "<tool_call>"],
  ["```xml\n<tool_call/>", "<tool_call>"],
  ["```\n<tool_call/>", "<tool_call>"],
  ["```tool_call>\n", "<tool_call>"],
  ["```tool_call\n", "<tool_call>"],
  ["```xml\n<tool_name>", "<tool_call>\n<tool_name>"],
  ["\n\n<tool_name>", "<tool_call>\n<tool_name>"],
  // ["```xml\n<name>", "<tool_call>\n<name>"],
];

export function detectToolCallStart(buffer: string) {
  let modifiedBuffer = buffer;
  const lowerCaseBuffer = buffer.toLowerCase();
  for (let i = 0; i < acceptedBoundaries.length; i++) {
    const [startTag, _] = acceptedBoundaries[i];
    debugger;
    if (lowerCaseBuffer.startsWith(startTag)) {
      boundaryTypeIndex = i;
      // for e.g. ```tool_call case, replace before adding to buffer, case insensitive
      if (boundaryTypeIndex !== 0) {
        modifiedBuffer = modifiedBuffer.replace(
          new RegExp(startTag, "i"),
          acceptedBoundaries[boundaryTypeIndex][1],
        );
      }
      return {
        isInToolCall: true,
        isInPartialStart: false,
        modifiedBuffer,
      };
    } else if (startTag.startsWith(lowerCaseBuffer)) {
      return {
        isInToolCall: false,
        isInPartialStart: true,
        modifiedBuffer,
      };
    }
  }
  return {
    isInToolCall: false,
    isInPartialStart: false,
    modifiedBuffer,
  };
}
