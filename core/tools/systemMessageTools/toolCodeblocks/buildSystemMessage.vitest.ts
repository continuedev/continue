import { describe, expect, it } from "vitest";
import { Tool } from "../../..";
import {
  TOOL_INSTRUCTIONS_TAG,
  addSystemMessageToolsToSystemMessage,
  generateToolsSystemMessage,
} from "../buildToolsSystemMessage";

import { SystemMessageToolCodeblocksFramework } from ".";
import { closeTag } from "../systemToolUtils";

const SHARED_TOOL_FIELDS = {
  displayTitle: "DUD",
  group: "DUD",
  readonly: true,
  type: "function" as const,
};

const framework = new SystemMessageToolCodeblocksFramework();

describe("createSystemMessageExampleCall", () => {
  it("creates a system message example call with no args", () => {
    const result = framework.createSystemMessageExampleCall(
      "test_tool",
      "Use this tool to test things",
    );
    expect(result).includes("Use this tool to test things");
    expect(result).includes("```tool");
    expect(result).includes("TOOL_NAME: test_tool");
    expect(result).includes("```");
  });

  it("creates a system message example call with args", () => {
    const result = framework.createSystemMessageExampleCall(
      "test_tool",
      "Use this tool to test things",
      [
        ["arg1", "value1"],
        ["arg2", "value2"],
      ],
    );

    expect(result).includes("Use this tool to test things");
    expect(result).includes("```tool");
    expect(result).includes("TOOL_NAME: test_tool");
    expect(result).includes("BEGIN_ARG: arg1");
    expect(result).includes("value1");
    expect(result).includes("END_ARG");
    expect(result).includes("BEGIN_ARG: arg2");
    expect(result).includes("value2");
  });

  it("handles multiline arg values correctly", () => {
    const multilineValue = "value\nwith\nmultiple\nlines";
    const result = framework.createSystemMessageExampleCall(
      "test_tool",
      "Use this tool to test things",
      [["arg1", multilineValue]],
    );

    expect(result).includes("BEGIN_ARG: arg1");
    expect(result).includes(multilineValue);
    expect(result).includes("END_ARG");
  });
});

describe("generateToolsSystemMessage", () => {
  it("returns empty string for empty tools array", () => {
    const result = generateToolsSystemMessage([], framework);
    expect(result).toBe("");
  });

  it("generates system message for tools with system message descriptions", () => {
    const customDescription =
      "This is test tool 1's system message description";
    const tools: Tool[] = [
      {
        function: {
          name: "test_tool1",
          description: "Test tool 1 description",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        systemMessageDescription: {
          prefix: customDescription,
        },
        ...SHARED_TOOL_FIELDS,
      },
    ];

    const result = generateToolsSystemMessage(tools, framework);

    // Check structure rather than exact text
    expect(result).includes(TOOL_INSTRUCTIONS_TAG);
    expect(result).includes(customDescription);
    expect(result).includes(closeTag(TOOL_INSTRUCTIONS_TAG));

    // Check for general section about available tools without requiring exact wording
    const hasToolsAvailableSection = /tools are available to you/i.test(result);
    expect(hasToolsAvailableSection).toBe(true);
  });

  it("generates system message for tools without system message descriptions", () => {
    const toolName = "test_tool2";
    const toolDesc = "Test tool 2 description";
    const paramDesc = "Parameter 1 description";

    const tools: Tool[] = [
      {
        function: {
          name: toolName,
          description: toolDesc,
          parameters: {
            type: "object",
            properties: {
              param1: {
                type: "string",
                description: paramDesc,
              },
            },
            required: ["param1"],
          },
        },
        ...SHARED_TOOL_FIELDS,
      },
    ];

    const result = generateToolsSystemMessage(tools, framework);

    // Check for key elements without requiring exact wording
    expect(result).includes(`TOOL_NAME: ${toolName}`);
    expect(result).includes("TOOL_DESCRIPTION:");
    expect(result).includes(toolDesc);
    expect(result).includes("TOOL_ARG: param1 (string, required)");
    expect(result).includes(paramDesc);

    // Check for dynamic tool section without exact text matching
    const hasDynamicToolsSection = /additional tool definitions/i.test(result);
    expect(hasDynamicToolsSection).toBe(true);
  });

  it("handles tools with and without system message descriptions", () => {
    const customMsg = "Custom system message";
    const tools: Tool[] = [
      {
        function: {
          name: "tool_with_description",
          description: "Tool description",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        systemMessageDescription: {
          prefix: customMsg,
        },
        ...SHARED_TOOL_FIELDS,
      },
      {
        function: {
          name: "tool_without_description",
          description: "Another tool description",
          parameters: {
            type: "object",
            properties: {
              param1: {
                type: "string",
                description: "Parameter description",
              },
            },
            required: ["param1"],
          },
        },
        ...SHARED_TOOL_FIELDS,
      },
    ];

    const result = generateToolsSystemMessage(tools, framework);

    // Check for both types of tools
    expect(result).includes(customMsg);
    expect(result).includes("TOOL_NAME: tool_without_description");

    // Verify structure without exact text matching
    const hasAvailableToolsSection = /tools are available to you/i.test(result);
    expect(hasAvailableToolsSection).toBe(true);

    const hasDynamicToolsSection = /additional tool definitions/i.test(result);
    expect(hasDynamicToolsSection).toBe(true);
  });

  it("includes example tool definition and call", () => {
    const tools: Tool[] = [
      {
        function: {
          name: "test_tool",
          description: "Test description",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        ...SHARED_TOOL_FIELDS,
      },
    ];

    const result = generateToolsSystemMessage(tools, framework);

    // Check for example sections without exact text
    expect(result).includes("```tool_definition");
    expect(result).includes("TOOL_NAME: example_tool");
    expect(result).includes("```tool");

    // Check for example format structure
    const hasExampleDefinition = /example.*tool definition/i.test(result);
    const hasExampleCall = /called like this/i.test(result);

    expect(hasExampleDefinition).toBe(true);
    expect(hasExampleCall).toBe(true);
  });
});

describe("addSystemMessageToolsToSystemMessage", () => {
  it("returns original system message when no tools are provided", () => {
    const baseMessage = "This is the base system message";
    const result = addSystemMessageToolsToSystemMessage(
      framework,
      baseMessage,
      [],
    );
    expect(result).toBe(baseMessage);
  });

  it("appends tools system message to base message", () => {
    const baseMessage = "This is the base system message";
    const toolName = "test_tool";
    const tools: Tool[] = [
      {
        function: {
          name: toolName,
          description: "Test description",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        ...SHARED_TOOL_FIELDS,
      },
    ];

    const result = addSystemMessageToolsToSystemMessage(
      framework,
      baseMessage,
      tools,
    );

    expect(result.startsWith(baseMessage)).toBe(true);
    expect(result).includes(TOOL_INSTRUCTIONS_TAG);
    expect(result).includes(`TOOL_NAME: ${toolName}`);
  });
});
