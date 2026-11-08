import { describe, expect, it } from "vitest";

import { BedrockApi } from "./Bedrock.js";

/**
 * Live check that Amazon Nova on Bedrock caches when the adapter puts cache
 * points on the system prompt and the messages (and none on the tools, which
 * Nova refuses). The AWS prompt caching guide lists Nova 2 Lite, Pro, Lite and
 * Micro with a 1K-token minimum, 5 minutes, `system` and `messages`.
 *
 * Opt-in: RUN_BEDROCK_LIVE=1 and a Bedrock credential in the environment
 * (AWS_BEARER_TOKEN_BEDROCK, or AWS_PROFILE). Three requests of about 1,600
 * input tokens each on Nova 2 Lite cost well under a cent.
 *
 *   RUN_BEDROCK_LIVE=1 npx vitest run src/apis/Bedrock.novaCache.live.vitest.ts
 *
 * Knobs: LIVE_MODELS (comma-separated model IDs), AWS_REGION, AWS_PROFILE.
 */
const live = process.env.RUN_BEDROCK_LIVE === "1" ? describe : describe.skip;

const MODELS = (process.env.LIVE_MODELS ?? "us.amazon.nova-2-lite-v1:0")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// About 1,500 tokens, well over Nova's 1K minimum. A nonce makes every run's
// first request a clean write rather than a read of an earlier run's entry.
const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const SYSTEM = [
  `Session ${nonce}. You are a terse assistant for a code repository.`,
  ...Array.from(
    { length: 60 },
    (_, i) =>
      `Rule ${i + 1}: when the user asks about file number ${i + 1}, answer with the file's purpose in one sentence, name its owner team, and do not quote its contents.`,
  ),
].join("\n");

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

live("Nova prompt caching on Bedrock", () => {
  it.each(MODELS)(
    "%s writes on the first request and reads on the next",
    async (model) => {
      const api = new BedrockApi({
        provider: "bedrock",
        promptCaching: true,
        env: {
          region: process.env.AWS_REGION ?? "us-east-1",
          profile: process.env.AWS_PROFILE,
        },
      } as any);
      const usages: any[] = [];
      for (const ask of [
        "Reply with the word one.",
        "Reply with the word two.",
      ]) {
        const body: any = {
          model,
          stream: true,
          max_tokens: 20,
          tools: [tool],
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: ask },
          ],
        };
        for await (const chunk of api.chatCompletionStream(
          body,
          new AbortController().signal,
        )) {
          if (chunk.usage) usages.push(chunk.usage);
        }
      }
      expect(usages).toHaveLength(2);
      const [first, second] = usages.map((u) => u.prompt_tokens_details);
      // eslint-disable-next-line no-console
      console.log(model, JSON.stringify({ first, second }));
      expect(first.cache_write_tokens).toBeGreaterThan(1000);
      expect(second.cache_read_tokens).toBeGreaterThan(1000);
    },
    60_000,
  );
});
