import { describe, expect, it } from "vitest";

import { AnthropicApi } from "./Anthropic.js";
import { BedrockApi } from "./Bedrock.js";
import { NO_PROMPT_CACHE_FIELD, optsOutOfPromptCache } from "./cacheTtl.js";

class TestBedrock extends BedrockApi {
  protected async credentialChain() {
    return { accessKeyId: "k", secretAccessKey: "s" };
  }
}

const sonnet = "us.anthropic.claude-sonnet-4-6";
const chat = {
  model: sonnet,
  messages: [
    { role: "system", content: "sys" },
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
    { role: "user", content: "c" },
  ],
  tools: [
    {
      type: "function",
      function: { name: "ls", description: "d", parameters: {} },
    },
  ],
} as any;
const title = {
  model: sonnet,
  messages: [{ role: "user", content: "Given the following... title" }],
  max_tokens: 16,
} as any;
const optedOut = { ...title, [NO_PROMPT_CACHE_FIELD]: true };

const bedrock = (config: object = {}) =>
  new TestBedrock({
    provider: "bedrock",
    env: {},
    promptCaching: true,
    ...config,
  } as any) as any;

const bedrockPoints = (api: any, body: any) => {
  const out = api._convertBody(body);
  return [
    ...(out.system ?? []),
    ...(out.toolConfig?.tools ?? []),
    ...out.messages.flatMap((m: any) => m.content),
  ]
    .filter((b: any) => b.cachePoint)
    .map((b: any) => b.cachePoint);
};

describe("optsOutOfPromptCache", () => {
  it("is true only for the field set to true", () => {
    expect(optsOutOfPromptCache({ [NO_PROMPT_CACHE_FIELD]: true })).toBe(true);
    expect(optsOutOfPromptCache({ [NO_PROMPT_CACHE_FIELD]: false })).toBe(
      false,
    );
    expect(optsOutOfPromptCache({ [NO_PROMPT_CACHE_FIELD]: "yes" })).toBe(
      false,
    );
    expect(optsOutOfPromptCache({})).toBe(false);
    expect(optsOutOfPromptCache(undefined)).toBe(false);
  });
});

describe("Bedrock: a request that opts out", () => {
  it("carries no cache points, where the same request otherwise does", () => {
    expect(bedrockPoints(bedrock(), title).length).toBeGreaterThan(0);
    expect(bedrockPoints(bedrock(), optedOut)).toEqual([]);
  });

  it("does not move the conversation's Auto count", () => {
    const api = bedrock({ cacheBehavior: { ttl: "auto" } });
    const ttl = (body: any) => bedrockPoints(api, body)[0]?.ttl;
    // four ordinary requests would leave the fifth on 1h; a title between
    // them must not bring that forward or push it back
    expect(ttl(chat)).toBeUndefined();
    expect(bedrockPoints(api, optedOut)).toEqual([]);
    expect(ttl(chat)).toBeUndefined();
    expect(ttl(chat)).toBeUndefined();
    expect(ttl(chat)).toBeUndefined();
    expect(ttl(chat)).toBe("1h"); // the fifth conversation request
  });

  it("leaves the rest of the request as it was", () => {
    // A cache point is a block of its own: compare what is left once they are
    // removed.
    const clean = (b: any) =>
      JSON.stringify(b, (k, v) => {
        if (Array.isArray(v)) return v.filter((x) => !x?.cachePoint);
        return v;
      });
    const plain = bedrock()._convertBody(title);
    const out = bedrock()._convertBody(optedOut);
    expect(clean(out)).toBe(clean(plain));
    expect(JSON.stringify(out)).not.toContain(NO_PROMPT_CACHE_FIELD);
  });
});

describe("Anthropic: a request that opts out", () => {
  const api = (config: object = {}) =>
    new AnthropicApi({
      provider: "anthropic",
      apiKey: "k",
      ...config,
    } as any) as any;
  const body = (b: any) => ({ ...b, model: "claude-sonnet-4-6" });
  const marks = (out: any) =>
    JSON.stringify(out).match(/"cache_control"/g)?.length ?? 0;

  it("carries no cache_control, where the same request otherwise does", () => {
    expect(marks(api()._convertBody(body(title)))).toBeGreaterThan(0);
    expect(marks(api()._convertBody(body(optedOut)))).toBe(0);
  });

  it("does not move the conversation's Auto count", () => {
    const a = api({ cacheBehavior: { ttl: "auto" } });
    const ttlOf = (b: any) =>
      JSON.stringify(a._convertBody(body(b))).includes('"ttl":"1h"');
    a._convertBody(body(optedOut));
    a._convertBody(body(optedOut));
    for (let i = 0; i < 4; i++) expect(ttlOf(chat)).toBe(false);
    expect(ttlOf(chat)).toBe(true);
  });

  it("does not send the field to Anthropic", () => {
    expect(JSON.stringify(api()._convertBody(body(optedOut)))).not.toContain(
      NO_PROMPT_CACHE_FIELD,
    );
  });
});
