import { ToolCall } from "core";
import { getXmlToolCallsFromContent } from "./parseXmlToolCalls";

test("getXmlToolCallsFromContent extracts single tool call correctly", () => {
  const content = `
    <tool_call>
      <name>test_tool</name>
      <args>
        <param1>value1</param1>
      </args>
    </tool_call>
  `;

  const result = getXmlToolCallsFromContent(content);

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    id: "tool-call-0",
    type: "function",
    function: {
      name: "test_tool",
      arguments: JSON.stringify({
        param1: "value1",
      }),
    },
  });
});

test("getXmlToolCallsFromContent extracts multiple tool calls correctly", () => {
  const content = `
    <tool_call>
      <name>tool1</name>
      <args>
        <param1>value1</param1>
      </args>
    </tool_call>
    <tool_call>
      <name>tool2</name>
      <args>
        <param2>value2</param2>
      </args>
    </tool_call>
  `;

  const result = getXmlToolCallsFromContent(content);

  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({
    id: "tool-call-0",
    type: "function",
    function: {
      name: "tool1",
      arguments: JSON.stringify({
        param1: "value1",
      }),
    },
  });
  expect(result[1]).toEqual({
    id: "tool-call-1",
    type: "function",
    function: {
      name: "tool2",
      arguments: JSON.stringify({
        param2: "value2",
      }),
    },
  });
});

test("getXmlToolCallsFromContent preserves existing tool call IDs", () => {
  const content = `
    <tool_call>
      <name>test_tool</name>
      <args>
        <param1>value1</param1>
      </args>
    </tool_call>
  `;

  const existingToolCalls: ToolCall[] = [
    {
      id: "existing-id",
      type: "function",
      function: {
        name: "old_tool",
        arguments: "{}",
      },
    },
  ];

  const result = getXmlToolCallsFromContent(content, existingToolCalls);

  expect(result[0].id).toBe("existing-id");
});

test("getXmlToolCallsFromContent returns empty array for content without tool calls", () => {
  const content = "Some content without tool calls";

  const result = getXmlToolCallsFromContent(content);

  expect(result).toEqual([]);
});
