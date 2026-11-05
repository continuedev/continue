import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ChatDescriber, NO_PROMPT_CACHE_FIELD } from "./chatDescriber";

const ADAPTER_SOURCE = resolve(
  __dirname,
  "../../packages/openai-adapters/src/apis/cacheTtl.ts",
);

describe("the title request leaves prompt caching alone (C29)", () => {
  it("uses the same field name as the adapters", () => {
    // Read as text, not imported: core must not pull packages/ into its build.
    const source = readFileSync(ADAPTER_SOURCE, "utf8");
    expect(source).toContain(
      `NO_PROMPT_CACHE_FIELD = "${NO_PROMPT_CACHE_FIELD}"`,
    );
  });

  const titleBody = async (provider: string) => {
    let sent: any;
    const llmApi = {
      chatCompletionNonStream: async (body: any) => {
        sent = body;
        return { choices: [{ message: { content: "A title" } }] };
      },
    };
    await ChatDescriber.describeWithBaseLlmApi(
      llmApi,
      { model: "m", provider },
      "Fix the login bug",
    );
    return sent;
  };

  it("asks the Anthropic and Bedrock adapters not to cache it", async () => {
    for (const provider of ["anthropic", "bedrock"]) {
      expect((await titleBody(provider))[NO_PROMPT_CACHE_FIELD]).toBe(true);
    }
  });

  it("adds nothing for a provider that would pass an unknown field on", async () => {
    for (const provider of ["openai", "openrouter", "gemini", "vertexai"]) {
      expect(NO_PROMPT_CACHE_FIELD in (await titleBody(provider))).toBe(false);
    }
  });

  it("changes nothing else about the request", async () => {
    const body = await titleBody("anthropic");
    expect(body).toMatchObject({
      model: "m",
      max_tokens: ChatDescriber.maxTokens,
      stream: false,
    });
  });
});
