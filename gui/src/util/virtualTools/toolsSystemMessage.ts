import { Tool } from "core";
import { XMLBuilder } from "fast-xml-parser";

export const TOOL_CALL_OPENING_TAG = "<tool_call>";
export const TOOL_CALL_CLOSING_TAG = "</tool_call>";
export const TOOL_CALL_NAME_OPENING_TAG = "<name>";
export const TOOL_CALL_NAME_CLOSING_TAG = "</name>";
export const TOOL_CALL_ARGS_OPENING_TAG = "<args>";
export const TOOL_CALL_ARGS_CLOSING_TAG = "</args>";

const EXAMPLE_TOOL = `<tool_definition>
    <name>example_tool</name>
    <args>
        <arg1>
            <description>First argument</description>
            <type>string</type>
            <required>true</required>
        </arg1>
        <arg2>
            <description>Second argument</description>
            <type>number</type>
            <required>false</required>
        </arg2>
    </args>
</tool_definition>
`;

const EXAMPLE_TOOL_CALL = `
<tool_call>
    <name>example_tool</name>
    <args>
        <arg1>value1</arg1>
    </args>
</tool_call>
`;

function toolToXmlDefinition(tool: Tool): string {
  const builder = new XMLBuilder({
    ignoreAttributes: true,
    format: true,
    suppressEmptyNode: true,
  });

  const obj = {
    tool_definition: {
      name: tool.function.name,
      args: tool.function.parameters,
    },
  };

  return builder.build(obj);
}

export const generateToolsSystemMessage = (tools: Tool[]) => {
  if (tools.length === 0) {
    return undefined;
  }
  let prompt = `The following tool definitions define tools that can be "called" to perform actions.
    Decided whether to use them based on the user's request and the context. 
    To use a tool, respond with a <tool_call> specifying name and args. Do NOT put a tool call in any codeblock. For example, this tool:`;

  prompt += EXAMPLE_TOOL;

  prompt += "\n\nCan be called like this:\n";

  prompt += EXAMPLE_TOOL_CALL;

  prompt += "\n\nHere are the available tools:\n\n";

  for (const tool of tools) {
    prompt += toolToXmlDefinition(tool);
    prompt += "\n";
  }
  return prompt;
};
