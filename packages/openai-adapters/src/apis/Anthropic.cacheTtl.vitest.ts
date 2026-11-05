import { describe, expect, it } from "vitest";
import { AnthropicApi } from "./Anthropic.js";
import { applyAnthropicCacheTtl } from "./cacheTtl.js";

const request = (model = "claude-sonnet-4-6") => ({
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

const make = (extra: Record<string, unknown> = {}) =>
  new AnthropicApi({ provider: "anthropic", apiKey: "k", ...extra } as any);

/** Every cache_control in an Anthropic body. */
function controls(body: any): any[] {
  const out: any[] = [];
  const visit = (blocks: any) =>
    Array.isArray(blocks) &&
    blocks.forEach((b) => b?.cache_control && out.push(b.cache_control));
  visit(body.system);
  visit(body.tools);
  (body.messages ?? []).forEach((m: any) => visit(m.content));
  return out;
}

const body = (api: any) => api._convertBody(request());

describe("AnthropicApi sends the cache lifetime", () => {
  it("is unchanged when no ttl is configured", () => {
    const found = controls(body(make()));
    expect(found.length).toBe(4);
    for (const c of found) expect(c).toEqual({ type: "ephemeral" });
  });

  it("puts ttl 1h on every cache point when cacheBehavior.ttl is 1h", () => {
    const found = controls(body(make({ cacheBehavior: { ttl: "1h" } })));
    expect(found.length).toBe(4);
    for (const c of found) expect(c).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  it("sends no ttl for 5m", () => {
    const found = controls(body(make({ cacheBehavior: { ttl: "5m" } })));
    for (const c of found) expect("ttl" in c).toBe(false);
  });

  it("sends nothing when the caching strategy is none", () => {
    const api = make({
      cachingStrategy: "none",
      cacheBehavior: { ttl: "1h" },
    });
    expect(controls(body(api))).toEqual([]);
  });

  it("with auto, moves to 1h at the fifth request of the instance", () => {
    const api = make({ cacheBehavior: { ttl: "auto" } });
    const ttls = Array.from({ length: 6 }, () => controls(body(api))[0].ttl);
    expect(ttls).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      "1h",
      "1h",
    ]);
  });
});

describe("applyAnthropicCacheTtl", () => {
  it("leaves blocks without cache_control alone", () => {
    const b = {
      system: [{ type: "text", text: "s" }],
      messages: [{ role: "user", content: "plain string" }],
    };
    expect(applyAnthropicCacheTtl(structuredClone(b), "1h")).toEqual(b);
  });

  it("returns the body untouched for 5m and undefined", () => {
    const b = { system: [{ cache_control: { type: "ephemeral" } }] };
    expect(applyAnthropicCacheTtl(structuredClone(b), "5m")).toEqual(b);
    expect(applyAnthropicCacheTtl(structuredClone(b), undefined)).toEqual(b);
  });
});
