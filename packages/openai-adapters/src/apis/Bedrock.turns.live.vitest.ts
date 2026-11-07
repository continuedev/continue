import { describe, expect, it } from "vitest";

import { BedrockApi } from "./Bedrock.js";

/**
 * Live Bedrock check that the conversation shapes the CLI's agent loop
 * produces are accepted: steering (extensions/cli/src/stream/steering.ts),
 * Stop, parallel calls, and a call left without a result. The IDE's provider
 * has the same check in core (llm/llms/Bedrock.turns.live.vitest.ts); keep
 * the two scenario lists alike.
 *
 * Opt-in: RUN_BEDROCK_LIVE=1 and a Bedrock credential in the environment
 * (AWS_BEARER_TOKEN_BEDROCK, or a profile). Costs well under a cent per run
 * on the default models.
 *
 *   RUN_BEDROCK_LIVE=1 npx vitest run src/apis/Bedrock.turns.live.vitest.ts
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

// core/tools/constants.ts CANCELLED_TOOL_CALL_MESSAGE
const CANCELLED = "The user cancelled this tool call.";

const tool = {
  type: "function" as const,
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
const callTurn = (
  content: string | null,
  ...calls: ReturnType<typeof call>[]
) => ({
  role: "assistant" as const,
  content,
  tool_calls: calls,
});
const result = (id: string, content: string) => ({
  role: "tool" as const,
  tool_call_id: id,
  content,
});

const TURN_SCENARIOS: Record<string, any[]> = {
  normal: [
    { role: "user", content: ASK },
    callTurn(null, call("tooluse_a1")),
    result("tooluse_a1", README),
  ],
  "steer after a tool result": [
    { role: "user", content: ASK },
    callTurn(null, call("tooluse_a1")),
    result("tooluse_a1", README),
    { role: "user", content: STEER },
  ],
  "cancelled call, then a steer": [
    { role: "user", content: ASK },
    callTurn(null, call("tooluse_a1")),
    result("tooluse_a1", CANCELLED),
    { role: "user", content: STEER },
  ],
  "parallel calls, one stopped": [
    {
      role: "user",
      content:
        "Read README.md and NOTES.md with read_file, then tell me each first word.",
    },
    callTurn(
      "Reading both.",
      call("tooluse_p1"),
      call("tooluse_p2", "NOTES.md"),
    ),
    result("tooluse_p1", README),
    result("tooluse_p2", CANCELLED),
    { role: "user", content: STEER },
  ],
  "call without a result": [
    { role: "user", content: ASK },
    callTurn(null, call("tooluse_o1")),
    { role: "user", content: STEER },
  ],
  "steer before any tool call": [
    { role: "user", content: ASK },
    { role: "assistant", content: "Let me look." },
    { role: "user", content: STEER },
  ],
};

live("Bedrock agent-loop turns through the adapter (live)", () => {
  describe.each(MODELS)("%s", (model) => {
    it.each(Object.keys(TURN_SCENARIOS))(
      "accepts: %s",
      async (scenario) => {
        const api = new BedrockApi({
          provider: "bedrock",
          env: { region: process.env.AWS_REGION ?? "us-east-1" },
        });
        const started = performance.now();
        let text = "";
        let toolCalls = 0;
        for await (const chunk of api.chatCompletionStream(
          {
            model,
            messages: TURN_SCENARIOS[scenario],
            tools: [tool],
            stream: true,
            max_tokens: 300,
            temperature: 0,
          },
          new AbortController().signal,
        )) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) text += delta.content;
          if (delta?.tool_calls?.length) toolCalls++;
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
