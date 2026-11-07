import { describe, expect, it } from "vitest";

import { BedrockApi } from "./Bedrock.js";
import {
  bedrockNeedsNineCharToolIds,
  nineCharToolId,
  normalizeToolUseIds,
} from "./bedrockHelpers.js";

const tool = {
  type: "function" as const,
  function: {
    name: "read_file",
    parameters: { type: "object", properties: { path: { type: "string" } } },
  },
};

describe("nine-character tool IDs for Mistral on Bedrock", () => {
  it("applies to Mistral model IDs only", () => {
    expect(bedrockNeedsNineCharToolIds("mistral.devstral-2-123b")).toBe(true);
    expect(
      bedrockNeedsNineCharToolIds("us.mistral.pixtral-large-2502-v1:0"),
    ).toBe(true);
    expect(
      bedrockNeedsNineCharToolIds(
        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      ),
    ).toBe(false);
    expect(bedrockNeedsNineCharToolIds("qwen.qwen3-coder-30b-a3b-v1:0")).toBe(
      false,
    );
  });

  it("maps any ID to nine letters or digits, stably, and keeps valid ones", () => {
    const id = nineCharToolId("tooluse_Ab3-xyz_0123456789");
    expect(id).toMatch(/^[A-Za-z0-9]{9}$/);
    expect(nineCharToolId("tooluse_Ab3-xyz_0123456789")).toBe(id);
    expect(nineCharToolId("tooluse_Ab3-xyz_0123456780")).not.toBe(id);
    expect(nineCharToolId("abc123XYZ")).toBe("abc123XYZ");
  });

  it("leaves other models' messages untouched", () => {
    const messages = [{ content: [{ toolUse: { toolUseId: "tooluse_a1" } }] }];
    normalizeToolUseIds(messages, "us.amazon.nova-lite-v1:0");
    expect(messages[0].content[0].toolUse.toolUseId).toBe("tooluse_a1");
  });

  it("rewrites toolUse and toolResult to the same ID in a converted request", () => {
    const api = new BedrockApi({
      provider: "bedrock",
      env: { region: "us-east-1" },
    } as any) as any;
    const body = api._convertBody({
      model: "mistral.devstral-2-123b",
      stream: true,
      tools: [tool],
      messages: [
        { role: "user", content: "Read README.md" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "tooluse_a1",
              type: "function",
              function: {
                name: "read_file",
                arguments: '{"path":"README.md"}',
              },
            },
          ],
        },
        { role: "tool", tool_call_id: "tooluse_a1", content: "Hello." },
      ],
    });
    const use = body.messages[1].content[0].toolUse.toolUseId;
    const result = body.messages[2].content[0].toolResult.toolUseId;
    expect(use).toMatch(/^[A-Za-z0-9]{9}$/);
    expect(result).toBe(use);
  });
});
