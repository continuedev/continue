import { describe, expect, it } from "vitest";
import { BedrockApi } from "./Bedrock.js";

class TestApi extends BedrockApi {
  protected async credentialChain() {
    return { accessKeyId: "k", secretAccessKey: "s" };
  }
}

const sonnet46 = "us.anthropic.claude-sonnet-4-6";
const sonnet45 = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

const request = (model: string) => ({
  model,
  messages: [
    { role: "system", content: "be brief" },
    { role: "user", content: "one" },
    { role: "assistant", content: "ok" },
    { role: "user", content: "two" },
  ],
  tools: [
    {
      type: "function",
      function: { name: "read", description: "d", parameters: {} },
    },
  ],
});

const build = (config: Record<string, unknown>, model = sonnet46) =>
  (
    new TestApi({ provider: "bedrock", env: {}, ...config } as any) as any
  )._convertBody(request(model));

/** Every cache point in a request body. */
function cachePoints(body: any): any[] {
  const out: any[] = [];
  const visit = (blocks: any[] | undefined) =>
    (blocks ?? []).forEach((b) => b.cachePoint && out.push(b.cachePoint));
  visit(body.system);
  visit(body.toolConfig?.tools);
  body.messages.forEach((m: any) => visit(m.content));
  return out;
}

describe("BedrockApi sends the cache lifetime", () => {
  it("puts ttl 1h on every cache point when cacheBehavior.ttl is 1h", () => {
    const points = cachePoints(
      build({ promptCaching: true, cacheBehavior: { ttl: "1h" } }),
    );
    expect(points.length).toBe(4);
    for (const p of points) expect(p).toEqual({ type: "default", ttl: "1h" });
  });

  it("sends no ttl for 5m, unset or auto on the first request", () => {
    for (const ttl of ["5m", undefined, "auto"] as const) {
      const points = cachePoints(
        build({ promptCaching: true, cacheBehavior: { ttl } }),
      );
      expect(points.length).toBe(4);
      for (const p of points) expect(p).toEqual({ type: "default" });
    }
  });

  it("sends no ttl to a model the AWS table does not list for 1 hour", () => {
    const points = cachePoints(
      build({ promptCaching: true, cacheBehavior: { ttl: "1h" } }, sonnet45),
    );
    expect(points.length).toBe(4);
    for (const p of points) expect("ttl" in p).toBe(false);
  });

  it("sends no cache points, so no ttl, to a non-Claude model", () => {
    const body = build(
      { promptCaching: true, cacheBehavior: { ttl: "1h" } },
      "openai.gpt-oss-120b",
    );
    expect(cachePoints(body)).toEqual([]);
  });

  it("sends nothing when caching is off, even with ttl set", () => {
    const body = build({ promptCaching: false, cacheBehavior: { ttl: "1h" } });
    expect(cachePoints(body)).toEqual([]);
  });
});

describe("BedrockApi with ttl: auto", () => {
  const firstPointTtl = (api: any) =>
    cachePoints(api._convertBody(request(sonnet46)))[0]?.ttl;

  it("moves to 1h at the fifth cached request of the same instance", () => {
    const api = new TestApi({
      provider: "bedrock",
      env: {},
      promptCaching: true,
      cacheBehavior: { ttl: "auto" },
    } as any);
    const ttls = Array.from({ length: 6 }, () => firstPointTtl(api));
    expect(ttls).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      "1h",
      "1h",
    ]);
  });

  it("does not count requests that carry no cache points", () => {
    const off = new TestApi({
      provider: "bedrock",
      env: {},
      cacheBehavior: { ttl: "auto" },
    } as any);
    for (let i = 0; i < 8; i++) {
      expect(cachePoints((off as any)._convertBody(request(sonnet46)))).toEqual(
        [],
      );
    }
    // a different instance is a different session
    const on = new TestApi({
      provider: "bedrock",
      env: {},
      promptCaching: true,
      cacheBehavior: { ttl: "auto" },
    } as any);
    expect(firstPointTtl(on)).toBeUndefined();
  });

  it("counts a request for a model that takes no ttl, so the count stays honest", () => {
    const api = new TestApi({
      provider: "bedrock",
      env: {},
      promptCaching: true,
      cacheBehavior: { ttl: "auto" },
    } as any);
    for (let i = 0; i < 4; i++) {
      (api as any)._convertBody(request(sonnet45));
    }
    // the fifth request, now on a model that accepts 1h
    expect(firstPointTtl(api)).toBe("1h");
  });
});
