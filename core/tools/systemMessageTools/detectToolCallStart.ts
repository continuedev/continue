let boundaryTypeIndex = 0;
const acceptedBoundaries: [string, string][] = [
  ["<tool_call>", "<tool_call>"],
  ["```xml\n<tool_call/>", "</tool_call>\n```"],
  ["```\n<tool_call/>", "</tool_call>\n```"],
  ["```tool_call>\n", "</tool_call>"],
  ["```tool_call\n", "</tool_call>"],
]; // end tag not currently used, just checks for </tool_call>, but should be used for multiple tool call support

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
          "<tool_call>",
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
