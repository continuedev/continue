import { ToolCall, ToolCallDelta } from "core";
import { XMLParser } from "fast-xml-parser";

export const getXmlToolCallsFromContent = (
  content: string,
  existingToolCalls: ToolCallDelta[] = [],
): ToolCall[] => {
  const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  const matches = [...content.matchAll(toolCallRegex)].map((match) =>
    match[0].trim(),
  );

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
    trimValues: true,
  });

  return matches.map((match, index) => {
    const parsed = parser.parse(match);
    return {
      id: existingToolCalls[index]?.id ?? `tool-call-${index}`,
      type: "function",
      function: {
        name: parsed["tool_call"]?.name,
        arguments: JSON.stringify(parsed["tool_call"]?.args),
      },
    };
  });
};
