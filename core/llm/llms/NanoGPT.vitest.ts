import { fetchwithRequestOptions } from "@continuedev/fetch";
import { Response as FetchResponse } from "node-fetch";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContinueConfig, ILLMLogger } from "../../index.js";
import { llmsFromModelConfig } from "../../config/yaml/models.js";
import NanoGPT from "./NanoGPT.js";

vi.mock("@continuedev/fetch", async () => ({
  ...(await vi.importActual("@continuedev/fetch")),
  fetchwithRequestOptions: vi.fn(),
}));

const model = "deepseek/deepseek-v4.1-flash";

describe("NanoGPT", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads a named YAML provider with its default base URL and tool capability", async () => {
    const llms = await llmsFromModelConfig({
      model: {
        name: "DeepSeek V4.1 Flash",
        provider: "nanogpt",
        model,
        apiKey: "test-api-key",
        capabilities: ["tool_use"],
      },
      uniqueId: "test",
      llmLogger: {} as ILLMLogger,
      config: {} as ContinueConfig,
    });

    expect(llms).toHaveLength(1);
    expect(llms[0]).toBeInstanceOf(NanoGPT);
    expect(llms[0].apiBase).toBe("https://nano-gpt.com/api/v1/");
    expect(llms[0].capabilities?.tools).toBe(true);
    // The server applies the model's chat template.
    expect(llms[0].templateMessages).toBeUndefined();
  });

  it("discovers exact model IDs with authenticated GET /models", async () => {
    const llm = new NanoGPT({ model, apiKey: "test-api-key" });
    const fetch = vi
      .spyOn(llm, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: model }] })),
      );

    await expect(llm.listModels()).resolves.toEqual([model]);
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://nano-gpt.com/api/v1/models"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      }),
    );
  });

  it("propagates discovery failures instead of inventing a model list", async () => {
    const llm = new NanoGPT({ model });
    vi.spyOn(llm, "fetch").mockRejectedValue(new Error("Unauthorized"));
    await expect(llm.listModels()).rejects.toThrow("Unauthorized");
  });

  it("keeps explicit API base overrides", () => {
    const llm = new NanoGPT({ model, apiBase: "https://example.com/v1" });
    expect(llm.apiBase).toBe("https://example.com/v1/");
  });

  it("uses chat completions for complete rather than a legacy completion endpoint", async () => {
    const llm = new NanoGPT({ model });
    const fetch = vi
      .spyOn(llm, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "OK" } }] }),
        ),
      );
    await expect(
      llm.complete("Say OK", new AbortController().signal, {
        log: false,
        stream: false,
      }),
    ).resolves.toBe("OK");
    expect(fetch.mock.calls[0][0].toString()).toBe(
      "https://nano-gpt.com/api/v1/chat/completions",
    );
  });

  it("streams tool calls and preserves the tool result on the next turn through the shared adapter", async () => {
    const llm = new NanoGPT({ model, apiKey: "test-api-key" });
    const toolCall = {
      id: "call_test",
      type: "function" as const,
      function: { name: "read_file", arguments: '{"path":"src/add.ts"}' },
    };
    const fetch = vi.mocked(fetchwithRequestOptions);
    fetch.mockResolvedValueOnce(
      new FetchResponse(
        `data: ${JSON.stringify({
          id: "test",
          choices: [
            {
              index: 0,
              delta: {
                role: "assistant",
                tool_calls: [{ index: 0, ...toolCall }],
              },
              finish_reason: null,
            },
          ],
        })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    const chunks = [];
    for await (const chunk of llm.streamChat(
      [{ role: "user", content: "Read src/add.ts" }],
      new AbortController().signal,
      { log: false },
    )) {
      chunks.push(chunk);
    }
    expect(chunks).toContainEqual(
      expect.objectContaining({
        role: "assistant",
        toolCalls: [toolCall],
      }),
    );

    fetch.mockResolvedValueOnce(
      new FetchResponse(
        JSON.stringify({
          id: "test-result",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "OK" },
              finish_reason: "stop",
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    for await (const _ of llm.streamChat(
      [
        { role: "user", content: "Read src/add.ts" },
        { role: "assistant", content: "", toolCalls: [toolCall] },
        {
          role: "tool",
          toolCallId: toolCall.id,
          content: "export const add = (a, b) => a + b;",
        },
      ],
      new AbortController().signal,
      { log: false, stream: false },
    )) {
      // Consume the response to exercise the tool-result request.
    }
    const [url, init] = fetch.mock.calls.at(-1)!;
    expect(url.toString()).toBe("https://nano-gpt.com/api/v1/chat/completions");
    expect(new Headers(init?.headers as HeadersInit).get("authorization")).toBe(
      "Bearer test-api-key",
    );
    expect(JSON.parse(init?.body as string)).toMatchObject({
      model,
      stream: false,
      messages: [
        { role: "user", content: "Read src/add.ts" },
        { role: "assistant", tool_calls: [toolCall] },
        {
          role: "tool",
          tool_call_id: "call_test",
          content: "export const add = (a, b) => a + b;",
        },
      ],
    });
  });
});
