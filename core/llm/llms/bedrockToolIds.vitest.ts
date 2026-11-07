import { describe, expect, it } from "vitest";

import Bedrock from "./Bedrock";
import { nineCharToolId, normalizeToolUseIds } from "./bedrockHelpers";

const tool = {
  type: "function" as const,
  function: {
    name: "read_file",
    parameters: { type: "object", properties: { path: { type: "string" } } },
  },
};

function convert(model: string) {
  // Core sends native tools to Mistral on Bedrock only when the model config
  // turns them on (`capabilities: [tool_use]`), so the test does too.
  const llm = new Bedrock({
    apiKey: "k",
    model,
    region: "us-east-1",
    capabilities: { tools: true },
  } as any) as any;
  return llm._generateConverseInput(
    [
      { role: "user", content: "Read README.md" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tooluse_a1",
            type: "function",
            function: { name: "read_file", arguments: '{"path":"README.md"}' },
          },
        ],
      },
      { role: "tool", toolCallId: "tooluse_a1", content: "Hello." },
    ],
    { model, tools: [tool] },
  );
}

describe("Bedrock tool IDs for Mistral models", () => {
  it("gives the toolUse and its toolResult the same nine-character ID", () => {
    const input = convert("mistral.devstral-2-123b");
    const use = input.messages[1].content[0].toolUse.toolUseId;
    const result = input.messages[2].content[0].toolResult.toolUseId;
    expect(use).toMatch(/^[A-Za-z0-9]{9}$/);
    expect(result).toBe(use);
    expect(use).toBe(nineCharToolId("tooluse_a1"));
  });

  it("keeps the original ID for other models", () => {
    const input = convert("us.amazon.nova-lite-v1:0");
    expect(input.messages[1].content[0].toolUse.toolUseId).toBe("tooluse_a1");
  });

  it("matches the adapter's mapping", () => {
    // The CLI (openai-adapters) and the IDE (core) must agree, so a session
    // moved between them keeps matching IDs.
    expect(nineCharToolId("tooluse_a1")).toMatchInlineSnapshot(`"hsQPo5ez2"`);
    const messages = [
      { content: [{ toolResult: { toolUseId: "abc123XYZ" } }] },
    ];
    normalizeToolUseIds(messages, "mistral.ministral-3-8b-instruct");
    expect(messages[0].content[0].toolResult.toolUseId).toBe("abc123XYZ");
  });
});
