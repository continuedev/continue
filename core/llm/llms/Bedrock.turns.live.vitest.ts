import { describe, expect, it } from "vitest";

import { ChatMessage, Tool } from "../../index.js";
import { CANCELLED_TOOL_CALL_MESSAGE } from "../../tools/constants.js";
import Bedrock from "./Bedrock";

/**
 * Live Bedrock check that the conversation shapes the agent loop produces are
 * accepted: steering, Stop, parallel calls, and a call left without a result.
 * The CLI's converter has the same check in openai-adapters
 * (src/apis/Bedrock.turns.live.vitest.ts); keep the two scenario lists alike.
 *
 * Opt-in: RUN_BEDROCK_LIVE=1 and a Bedrock credential in the environment
 * (AWS_BEARER_TOKEN_BEDROCK, or a profile). Costs well under a cent per run
 * on the default models.
 *
 *   RUN_BEDROCK_LIVE=1 npx vitest run llm/llms/Bedrock.turns.live.vitest.ts
 *
 * Knobs: LIVE_MODELS (comma-separated model IDs), AWS_REGION.
 */
const live = process.env.RUN_BEDROCK_LIVE === "1" ? describe : describe.skip;

const MODELS = (
  process.env.LIVE_MODELS ??
  "qwen.qwen3-coder-30b-a3b-v1:0,us.amazon.nova-lite-v1:0,mistral.ministral-3-8b-instruct,openai.gpt-oss-120b-1:0"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const tool: Tool = {
  type: "function",
  displayTitle: "Read file",
  readonly: true,
  group: "test",
  function: {
    name: "read_file",
    description: "Read a file in the workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
};

const ASK =
  "Read README.md with the read_file tool, then tell me its first word.";
const STEER = "Actually, also tell me its last word. Answer in one short line.";
const README = "Hello from the readme. Goodbye.";

// IDs in another model's format on purpose: a conversation keeps the IDs of
// whichever model made each call, so a model switch hands these to the next.
const call = (id: string, path = "README.md") => ({
  id,
  type: "function" as const,
  function: { name: "read_file", arguments: JSON.stringify({ path }) },
});

/** Histories as gui/src/redux/util/constructMessages.ts builds them. */
const TURN_SCENARIOS: Record<string, ChatMessage[]> = {
  normal: [
    { role: "user", content: ASK },
    { role: "assistant", content: "", toolCalls: [call("tooluse_a1")] },
    { role: "tool", toolCallId: "tooluse_a1", content: README },
  ],
  "steer after a tool result": [
    { role: "user", content: ASK },
    { role: "assistant", content: "", toolCalls: [call("tooluse_a1")] },
    { role: "tool", toolCallId: "tooluse_a1", content: README },
    { role: "user", content: STEER },
  ],
  "cancelled call, then a steer": [
    { role: "user", content: ASK },
    { role: "assistant", content: "", toolCalls: [call("tooluse_a1")] },
    {
      role: "tool",
      toolCallId: "tooluse_a1",
      content: CANCELLED_TOOL_CALL_MESSAGE,
    },
    { role: "user", content: STEER },
  ],
  "parallel calls, one stopped": [
    {
      role: "user",
      content:
        "Read README.md and NOTES.md with read_file, then tell me each first word.",
    },
    {
      role: "assistant",
      content: "Reading both.",
      toolCalls: [call("tooluse_p1"), call("tooluse_p2", "NOTES.md")],
    },
    { role: "tool", toolCallId: "tooluse_p1", content: README },
    {
      role: "tool",
      toolCallId: "tooluse_p2",
      content: CANCELLED_TOOL_CALL_MESSAGE,
    },
    { role: "user", content: STEER },
  ],
  "call without a result": [
    { role: "user", content: ASK },
    { role: "assistant", content: "", toolCalls: [call("tooluse_o1")] },
    { role: "user", content: STEER },
  ],
  "steer before any tool call": [
    { role: "user", content: ASK },
    { role: "assistant", content: "Let me look." },
    { role: "user", content: STEER },
  ],
};

live("Bedrock agent-loop turns (live)", () => {
  describe.each(MODELS)("%s", (model) => {
    it.each(Object.keys(TURN_SCENARIOS))(
      "accepts: %s",
      async (scenario) => {
        // capabilities.tools sends native tools to every model, including
        // the ones core would otherwise give text-format tools.
        const llm = new Bedrock({
          model,
          region: process.env.AWS_REGION ?? "us-east-1",
          capabilities: { tools: true },
        });
        const started = performance.now();
        let text = "";
        let toolCalls = 0;
        for await (const message of llm.streamChat(
          TURN_SCENARIOS[scenario],
          new AbortController().signal,
          { tools: [tool], maxTokens: 300, temperature: 0 },
        )) {
          if (message.role !== "assistant") continue;
          if (typeof message.content === "string") text += message.content;
          if (message.toolCalls?.length) toolCalls++;
        }
        console.log(
          `LIVE turns ${model} | ${scenario} | ${(performance.now() - started).toFixed(0)}ms | toolCalls=${toolCalls} | ${JSON.stringify(text.slice(0, 100))}`,
        );
        expect(text.trim().length > 0 || toolCalls > 0).toBe(true);
      },
      60_000,
    );
  });
});
