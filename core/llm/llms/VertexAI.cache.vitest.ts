import { ChatCompletionCreateParams } from "openai/resources/index";
import { describe, expect, test } from "vitest";

import VertexAI from "./VertexAI";

// Claude on Vertex takes cache_control with ttl "1h":
// https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude/prompt-caching
// Chat goes through the openai-adapters converter, so what is asserted here is
// the body core hands to it; the converter test is in packages/openai-adapters.
describe("VertexAI Claude prompt caching", () => {
  const tools: ChatCompletionCreateParams["tools"] = [
    {
      type: "function",
      function: { name: "ls", description: "List", parameters: {} },
    },
    {
      type: "function",
      function: { name: "cat", description: "Read", parameters: {} },
    },
  ];
  const agentLoop = (): ChatCompletionCreateParams["messages"] => [
    { role: "system", content: "You are an agent." },
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
    { role: "tool", tool_call_id: "t1", content: "a.ts" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "t2",
          type: "function",
          function: { name: "cat", arguments: "{}" },
        },
      ],
    },
    { role: "tool", tool_call_id: "t2", content: "export const x = 1;" },
  ];

  function send(
    requestOptions: any,
    ctor: any = {},
    model = "claude-sonnet-4-5@20250929",
  ) {
    const vertex = new VertexAI({
      model,
      region: "us-east5",
      projectId: "p",
      env: { region: "us-east5", projectId: "p" },
      ...ctor,
    });
    return vertex["modifyChatBody"](
      { model, messages: agentLoop(), tools },
      requestOptions,
    ) as any;
  }

  /** Where the breakpoints landed, as readable labels. */
  function labels(body: any) {
    const out: string[] = [];
    body.tools?.forEach((t: any, i: number) => {
      if (t.cache_control) out.push(`tool${i}`);
    });
    body.messages.forEach((m: any, i: number) => {
      if (m.cache_control) out.push(`${m.role}${i}`);
      if (Array.isArray(m.content))
        m.content.forEach((p: any) => {
          if (p.cache_control) out.push(`${m.role}${i}.text`);
        });
    });
    return out;
  }
  const controls = (body: any) =>
    [
      ...(body.tools ?? []),
      ...body.messages,
      ...body.messages.flatMap((m: any) =>
        Array.isArray(m.content) ? m.content : [],
      ),
    ]
      .map((x: any) => x.cache_control)
      .filter(Boolean);

  test("sends no cache_control unless caching is asked for", () => {
    expect(controls(send({}))).toEqual([]);
  });

  test("promptCaching marks the system prompt, last tool and last two tool results", () => {
    const body = send({ promptCaching: true });
    expect(labels(body)).toEqual(["tool1", "system0.text", "tool3", "tool5"]);
    for (const c of controls(body)) expect(c).toEqual({ type: "ephemeral" });
  });

  test("sends the request's 1-hour lifetime on every breakpoint", () => {
    const body = send({ promptCaching: true, promptCacheTtl: "1h" });
    expect(controls(body)).toHaveLength(4);
    for (const c of controls(body))
      expect(c).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  test("uses cacheBehavior.ttl when the request does not choose", () => {
    const body = send(
      { promptCaching: true },
      { cacheBehavior: { ttl: "1h" } },
    );
    for (const c of controls(body))
      expect(c).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  test("the request's 5 minutes wins over cacheBehavior.ttl", () => {
    const body = send(
      { promptCaching: true, promptCacheTtl: "5m" },
      { cacheBehavior: { ttl: "1h" } },
    );
    for (const c of controls(body)) expect(c).toEqual({ type: "ephemeral" });
  });

  test("never sends ttl to Claude 3.x models, which Vertex lists as 5 minutes only", () => {
    for (const model of [
      "claude-3-7-sonnet@20250219",
      "claude-3-5-sonnet-v2@20241022",
      "claude-3-opus@20240229",
    ]) {
      const body = send(
        { promptCaching: true, promptCacheTtl: "1h" },
        {},
        model,
      );
      expect(controls(body)).toHaveLength(4);
      for (const c of controls(body)) expect(c).toEqual({ type: "ephemeral" });
    }
  });

  test("an explicit false overrides cacheBehavior", () => {
    const body = send(
      { promptCaching: false },
      { cacheBehavior: { cacheConversation: true, cacheSystemMessage: true } },
    );
    expect(controls(body)).toEqual([]);
  });

  test("cacheBehavior alone keeps its per-part meaning", () => {
    const body = send(
      {},
      { cacheBehavior: { cacheSystemMessage: true, ttl: "1h" } },
    );
    expect(labels(body)).toEqual(["system0.text"]);
    expect(controls(body)).toEqual([{ type: "ephemeral", ttl: "1h" }]);
  });

  test("ttl alone does not turn caching on", () => {
    expect(controls(send({}, { cacheBehavior: { ttl: "1h" } }))).toEqual([]);
  });

  test("streamChat hands the request's options to modifyChatBody and sends the result to the adapter", async () => {
    const vertex = new VertexAI({
      model: "claude-sonnet-4-5@20250929",
      region: "us-east5",
      projectId: "p",
      env: { region: "us-east5", projectId: "p" },
    });
    let sent: any;
    (vertex as any).openaiAdapter = {
      chatCompletionStream: async function* (body: any) {
        sent = body;
      },
    };
    for await (const _ of vertex.streamChat(
      [
        { role: "system", content: "You are an agent." },
        { role: "user", content: "hello" },
      ],
      new AbortController().signal,
      { promptCaching: true, promptCacheTtl: "1h", tools: [] },
    )) {
    }
    expect(controls(sent)).toEqual([
      { type: "ephemeral", ttl: "1h" },
      { type: "ephemeral", ttl: "1h" },
    ]);
  });

  test("leaves non-Claude Vertex models alone", () => {
    const body = send({ promptCaching: true }, {}, "gemini-2.5-pro");
    expect(controls(body)).toEqual([]);
  });
});
