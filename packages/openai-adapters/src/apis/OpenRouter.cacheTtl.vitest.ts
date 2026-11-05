import { describe, expect, it } from "vitest";

import { OpenRouterApi } from "./OpenRouter.js";
import { applyOpenAIBodyCacheTtl, cacheTtlInOpenAIBody } from "./cacheTtl.js";

const oneHour = () => ({ type: "ephemeral", ttl: "1h" });
const fiveMin = () => ({ type: "ephemeral" });

/** The body core's OpenRouter hands to the adapter when it has marked it. */
function markedBody(control: () => Record<string, unknown>, model: string) {
  return {
    model,
    messages: [
      {
        role: "system",
        content: [
          { type: "text", text: "You are an agent.", cache_control: control() },
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
        cache_control: control(),
      },
      {
        role: "user",
        content: [{ type: "text", text: "and this", cache_control: control() }],
      },
    ],
    tools: [
      {
        type: "function",
        function: { name: "ls", description: "List", parameters: {} },
        cache_control: control(),
      },
    ],
  } as any;
}

/** Every cache_control left in a body, wherever it sits. */
function controls(body: any): any[] {
  const out: any[] = [];
  for (const m of body.messages ?? []) {
    if (m.cache_control) out.push(m.cache_control);
    if (Array.isArray(m.content)) {
      for (const p of m.content) if (p.cache_control) out.push(p.cache_control);
    }
  }
  for (const t of body.tools ?? [])
    if (t.cache_control) out.push(t.cache_control);
  return out;
}

describe("cacheTtlInOpenAIBody", () => {
  it("finds 1h on a content part, a tool message or a tool definition", () => {
    expect(
      cacheTtlInOpenAIBody({
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "x", cache_control: oneHour() }],
          },
        ],
      }),
    ).toBe("1h");
    expect(
      cacheTtlInOpenAIBody({
        messages: [{ role: "tool", content: "x", cache_control: oneHour() }],
      }),
    ).toBe("1h");
    expect(
      cacheTtlInOpenAIBody({ tools: [{ cache_control: oneHour() }] }),
    ).toBe("1h");
  });

  it("is undefined for plain ephemeral marks, no marks, and an empty body", () => {
    expect(cacheTtlInOpenAIBody(markedBody(fiveMin, "m"))).toBeUndefined();
    expect(
      cacheTtlInOpenAIBody({ messages: [{ role: "user", content: "hi" }] }),
    ).toBeUndefined();
    expect(cacheTtlInOpenAIBody({})).toBeUndefined();
  });
});

describe("applyOpenAIBodyCacheTtl", () => {
  it("puts 1h on every mark and only on marks", () => {
    const body = markedBody(fiveMin, "m");
    applyOpenAIBodyCacheTtl(body, "1h");
    expect(controls(body)).toHaveLength(4);
    for (const c of controls(body)) expect(c).toEqual(oneHour());
    // an unmarked message gains nothing
    expect(body.messages[1]).toEqual({ role: "user", content: "fix it" });
  });

  it("leaves the body alone for 5m and for no lifetime", () => {
    for (const ttl of ["5m", undefined] as const) {
      const body = markedBody(fiveMin, "m");
      applyOpenAIBodyCacheTtl(body, ttl);
      for (const c of controls(body)) expect(c).toEqual(fiveMin());
    }
  });
});

describe("OpenRouterApi keeps the lifetime core asked for", () => {
  const api = () =>
    new OpenRouterApi({ provider: "openrouter", apiKey: "k" } as any) as any;

  it("a body core marked with 1h still says 1h after the adapter's own caching", () => {
    const out = api().modifyChatBody(
      markedBody(oneHour, "anthropic/claude-sonnet-4.6"),
    );
    const found = controls(out);
    expect(found.length).toBeGreaterThan(0);
    for (const c of found) expect(c).toEqual(oneHour());
  });

  it("marks added by the adapter's strategy get the lifetime as well", () => {
    // Core marked only the system prompt; the strategy adds the tool and the
    // last user messages, and those must not fall back to 5 minutes.
    const body = {
      model: "anthropic/claude-sonnet-4.6",
      messages: [
        {
          role: "system",
          content: [{ type: "text", text: "sys", cache_control: oneHour() }],
        },
        { role: "user", content: "one" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "two" },
      ],
      tools: [
        {
          type: "function",
          function: { name: "ls", description: "d", parameters: {} },
        },
      ],
    } as any;
    const out = api().modifyChatBody(body);
    const found = controls(out);
    expect(found.length).toBeGreaterThanOrEqual(3);
    for (const c of found) expect(c).toEqual(oneHour());
  });

  it("a body core marked for 5 minutes stays at 5 minutes", () => {
    const out = api().modifyChatBody(
      markedBody(fiveMin, "anthropic/claude-sonnet-4.6"),
    );
    for (const c of controls(out)) expect(c).toEqual(fiveMin());
  });

  it("a body core did not mark gets the default lifetime, as before", () => {
    const out = api().modifyChatBody({
      model: "anthropic/claude-sonnet-4.6",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hello" },
      ],
    } as any);
    const found = controls(out);
    expect(found.length).toBeGreaterThan(0);
    for (const c of found) expect(c).toEqual(fiveMin());
  });

  it("does not touch a non-Claude model", () => {
    const body = markedBody(oneHour, "openai/gpt-4o");
    const out = api().modifyChatBody(body);
    expect(out).toBe(body);
  });
});
