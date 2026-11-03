import { describe, expect, it } from "vitest";

import { VertexAIApi } from "./VertexAI.js";

// The body core's VertexAI.modifyChatBody hands to the adapter when caching is
// on with a 1-hour lifetime: marks on the system prompt, the last tool, a user
// text part and a tool message. The adapter must carry them into the Anthropic
// Messages body it sends to publishers/anthropic/models/...:streamRawPredict.
const oneHour = { type: "ephemeral", ttl: "1h" };

function api() {
  return new VertexAIApi({
    provider: "vertexai",
    env: { region: "us-east5", projectId: "p", keyJson: undefined },
  } as any);
}

describe("VertexAIApi Anthropic cache_control", () => {
  it("keeps cache_control on system, tools, user text and tool results", () => {
    const body: any = (api() as any).convertAnthropicBody({
      model: "claude-sonnet-4-5@20250929",
      stream: true,
      messages: [
        {
          role: "system",
          content: [
            { type: "text", text: "You are an agent.", cache_control: oneHour },
          ],
        },
        { role: "user", content: "fix it" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "t1",
              type: "function",
              function: { name: "ls", arguments: "{}" },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "t1",
          content: "a.ts",
          cache_control: oneHour,
        },
        {
          role: "user",
          content: [{ type: "text", text: "and this", cache_control: oneHour }],
        },
      ],
      tools: [
        {
          type: "function",
          function: { name: "ls", description: "List", parameters: {} },
          cache_control: oneHour,
        },
      ],
    });

    expect(body.anthropic_version).toBe("vertex-2023-10-16");
    expect(body.model).toBeUndefined();
    expect(body.system[0].cache_control).toEqual(oneHour);
    expect(body.tools[0].cache_control).toEqual(oneHour);
    // tool result and the next user text are merged into one user message
    const last = body.messages.at(-1);
    expect(last.content[0]).toMatchObject({
      type: "tool_result",
      cache_control: oneHour,
    });
    expect(last.content[1]).toMatchObject({
      type: "text",
      text: "and this",
      cache_control: oneHour,
    });
    // unmarked content stays unmarked
    expect(body.messages[0].content[0].cache_control).toBeUndefined();
  });

  it("sends no cache_control when nothing was marked", () => {
    const body: any = (api() as any).convertAnthropicBody({
      model: "claude-sonnet-4-5@20250929",
      messages: [
        { role: "system", content: "You are an agent." },
        { role: "user", content: "fix it" },
      ],
      tools: [
        {
          type: "function",
          function: { name: "ls", description: "List", parameters: {} },
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("cache_control");
  });
});
