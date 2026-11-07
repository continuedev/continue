import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchModels } from "./fetchModels";
import {
  contextLengthOf,
  detectLocalServers,
  listOpenAICompatibleModels,
  serverConcurrency,
} from "./localServers";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** What Strata's /v1/models returned on a running server. */
const STRATA_MODELS = {
  object: "list",
  data: [
    {
      id: "qwen3.8-flash-next-nvfp4-nvfp4",
      object: "model",
      status: { value: "loaded" },
      meta: { n_ctx: 524288 },
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    },
  ],
};

describe("contextLengthOf", () => {
  it("reads each server's name for the context window", () => {
    expect(contextLengthOf({ meta: { n_ctx: 524288 } })).toBe(524288); // llama.cpp, Strata
    expect(contextLengthOf({ max_model_len: 32768 })).toBe(32768); // vLLM
    expect(contextLengthOf({ max_context_length: 131072 })).toBe(131072); // LM Studio
    expect(contextLengthOf({ context_length: 200000 })).toBe(200000);
  });

  it("prefers the loaded window to the model's maximum", () => {
    expect(
      contextLengthOf({
        loaded_context_length: 8192,
        max_context_length: 131072,
      }),
    ).toBe(8192);
    expect(
      contextLengthOf({ meta: { n_ctx: 4096, n_ctx_train: 131072 } }),
    ).toBe(4096);
  });

  it("is undefined when nothing usable is reported", () => {
    expect(contextLengthOf({ id: "m" })).toBeUndefined();
    expect(contextLengthOf({ meta: { n_ctx: 0 } })).toBeUndefined();
    expect(contextLengthOf({ max_model_len: "8192" })).toBe(8192);
  });
});

describe("listOpenAICompatibleModels", () => {
  it("returns ids with the reported context, and sends the key", async () => {
    const fetchFn = vi.fn(async () => json(STRATA_MODELS));
    const models = await listOpenAICompatibleModels(
      "http://127.0.0.1:8080/v1",
      "secret",
      fetchFn as unknown as typeof fetch,
    );
    expect(models).toEqual([
      {
        name: "qwen3.8-flash-next-nvfp4-nvfp4",
        modelId: "qwen3.8-flash-next-nvfp4-nvfp4",
        contextLength: 524288,
        supportsImages: true,
      },
    ]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://127.0.0.1:8080/v1/models");
    expect(init.headers).toEqual({ Authorization: "Bearer secret" });
  });

  it("leaves out models that do not produce text", async () => {
    const fetchFn = vi.fn(async () =>
      json({
        data: [
          ...STRATA_MODELS.data,
          { id: "flux", architecture: { output_modalities: ["image"] } },
        ],
      }),
    );
    const models = await listOpenAICompatibleModels(
      "http://127.0.0.1:8080/v1/",
      undefined,
      fetchFn as unknown as typeof fetch,
    );
    expect(models.map((m) => m.name)).toEqual([
      "qwen3.8-flash-next-nvfp4-nvfp4",
    ]);
  });

  it("reports an error status", async () => {
    const fetchFn = vi.fn(async () => json({ error: "no" }, 401));
    await expect(
      listOpenAICompatibleModels(
        "http://127.0.0.1:8080/v1/",
        undefined,
        fetchFn as unknown as typeof fetch,
      ),
    ).rejects.toThrow("401");
  });
});

describe("fetchModels for OpenAI-compatible servers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the context window from a local OpenAI-compatible server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(STRATA_MODELS)),
    );
    const [m] = await fetchModels("openai", "", "http://127.0.0.1:8083/v1/");
    expect(m.contextLength).toBe(524288);
  });

  it("uses vLLM's max_model_len", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ data: [{ id: "m", max_model_len: 32768 }] })),
    );
    const [m] = await fetchModels("vllm", "", "http://127.0.0.1:8000/v1/");
    expect(m.contextLength).toBe(32768);
  });
});

describe("detectLocalServers", () => {
  /** Answers like a machine with Strata on 8083 and LM Studio on 1234. */
  function machine(url: URL | string): Response {
    const u = new URL(String(url));
    if (u.port === "8083" && u.pathname === "/v1/models")
      return json(STRATA_MODELS);
    if (u.port === "8083" && u.pathname === "/v1/status") {
      return json({
        service: "strata",
        model: "qwen3.8-flash-next-nvfp4-nvfp4",
      });
    }
    if (u.port === "1234" && u.pathname === "/v1/models") {
      return json({ data: [{ id: "qwen2.5-coder-7b" }] });
    }
    if (u.port === "1234") return json({ error: "not found" }, 404);
    if (u.port === "8000") return json({ error: "unauthorized" }, 401);
    throw new TypeError("fetch failed"); // nothing listening
  }

  it("finds servers on the presets and on ports after 8080, and names Strata", async () => {
    const fetchFn = vi.fn(async (url: URL | string) => machine(url));
    const found = await detectLocalServers({
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(found).toEqual([
      // vLLM's port answered, but only with a key
      {
        title: "vLLM",
        apiBase: "http://127.0.0.1:8000/v1/",
        models: [],
        needsKey: true,
      },
      {
        title: "LM Studio",
        apiBase: "http://127.0.0.1:1234/v1/",
        models: [{ name: "qwen2.5-coder-7b", modelId: "qwen2.5-coder-7b" }],
      },
      {
        title: "Strata",
        apiBase: "http://127.0.0.1:8083/v1/",
        models: [
          {
            name: "qwen3.8-flash-next-nvfp4-nvfp4",
            modelId: "qwen3.8-flash-next-nvfp4-nvfp4",
            contextLength: 524288,
            supportsImages: true,
          },
        ],
      },
    ]);
  });

  it("finds nothing when no server answers", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(
      await detectLocalServers({ fetchFn: fetchFn as unknown as typeof fetch }),
    ).toEqual([]);
  });
});

describe("capabilities from the server's own API", () => {
  const list =
    (
      routes: Record<string, unknown>,
    ): ((url: URL | string, init?: RequestInit) => Promise<Response>) =>
    async (url, init) => {
      const u = new URL(String(url));
      const key =
        init?.method === "POST"
          ? `POST ${u.pathname} ${String(init.body)}`
          : u.pathname;
      return key in routes
        ? json(routes[key])
        : json({ error: "not found" }, 404);
    };

  it("llama.cpp and Strata: tools and vision from /props", async () => {
    const fetchFn = vi.fn(
      list({
        "/v1/models": { data: [{ id: "qwen", meta: { n_ctx: 32768 } }] },
        "/props": {
          chat_template_caps: { supports_tools: true },
          modalities: { vision: true },
        },
      }),
    );
    const [m] = await listOpenAICompatibleModels(
      "http://127.0.0.1:8080/v1/",
      undefined,
      fetchFn as unknown as typeof fetch,
    );
    expect(m).toMatchObject({
      contextLength: 32768,
      supportsTools: true,
      supportsImages: true,
    });
  });

  it("llama.cpp with several slots: one slot's context from /props", async () => {
    const fetchFn = vi.fn(
      list({
        "/v1/models": { data: [{ id: "qwen", meta: { n_ctx: 65536 } }] },
        "/props": {
          default_generation_settings: { n_ctx: 16384 },
          total_slots: 4,
        },
      }),
    );
    const [m] = await listOpenAICompatibleModels(
      "http://127.0.0.1:8080/v1/",
      undefined,
      fetchFn as unknown as typeof fetch,
    );
    expect(m.contextLength).toBe(16384);
  });

  it("a template without tools says so", async () => {
    const fetchFn = vi.fn(
      list({
        "/v1/models": { data: [{ id: "base" }] },
        "/props": { chat_template_caps: { supports_tools: false } },
      }),
    );
    const [m] = await listOpenAICompatibleModels(
      "http://127.0.0.1:8080/v1/",
      undefined,
      fetchFn as unknown as typeof fetch,
    );
    expect(m.supportsTools).toBe(false);
  });

  it("LM Studio: the loaded context, vision and tool use from /api/v0/models", async () => {
    const fetchFn = vi.fn(
      list({
        "/v1/models": { data: [{ id: "qwen2-vl-7b" }, { id: "llama-3.2" }] },
        "/api/v0/models": {
          data: [
            {
              id: "qwen2-vl-7b",
              type: "vlm",
              max_context_length: 32768,
              loaded_context_length: 8192,
            },
            { id: "llama-3.2", type: "llm", capabilities: ["tool_use"] },
          ],
        },
      }),
    );
    const models = await listOpenAICompatibleModels(
      "http://127.0.0.1:1234/v1/",
      undefined,
      fetchFn as unknown as typeof fetch,
    );
    expect(models[0]).toMatchObject({
      name: "qwen2-vl-7b",
      contextLength: 8192,
      supportsImages: true,
    });
    expect(models[1]).toMatchObject({ name: "llama-3.2", supportsTools: true });
  });

  it("Ollama: capabilities from /api/show, the context only of a loaded model", async () => {
    const show = (model: string) =>
      `POST /api/show ${JSON.stringify({ model })}`;
    const fetchFn = vi.fn(
      list({
        "/v1/models": { data: [{ id: "qwen3:8b" }, { id: "llava:7b" }] },
        "/api/ps": { models: [{ name: "qwen3:8b", context_length: 8192 }] },
        [show("qwen3:8b")]: {
          capabilities: ["completion", "tools", "thinking"],
          model_info: { "qwen3.context_length": 40960 },
        },
        [show("llava:7b")]: {
          capabilities: ["completion", "vision"],
          model_info: { "llama.context_length": 32768 },
        },
      }),
    );
    const models = await listOpenAICompatibleModels(
      "http://127.0.0.1:11434/v1/",
      undefined,
      fetchFn as unknown as typeof fetch,
    );
    expect(models[0]).toMatchObject({
      name: "qwen3:8b",
      contextLength: 8192,
      supportsTools: true,
    });
    // Not loaded: the trained maximum is not what Ollama runs with
    expect(models[1].contextLength).toBeUndefined();
    expect(models[1]).toMatchObject({
      supportsTools: false,
      supportsImages: true,
    });
  });
});

describe("serverConcurrency", () => {
  const routes =
    (body: Record<string, unknown>) =>
    async (url: URL | string): Promise<Response> => {
      const path = new URL(String(url)).pathname;
      return path in body ? json(body[path]) : json({ error: "no" }, 404);
    };

  it("Strata: concurrency.serving from /v1/status", async () => {
    const fetchFn = routes({
      "/v1/status": { service: "strata", concurrency: { serving: 1 } },
      "/props": { total_slots: 4 },
    });
    expect(
      await serverConcurrency(
        "http://127.0.0.1:8083/v1/",
        undefined,
        fetchFn as unknown as typeof fetch,
      ),
    ).toBe(1);
  });

  it("llama.cpp: total_slots from /props", async () => {
    const fetchFn = routes({ "/props": { total_slots: 4 } });
    expect(
      await serverConcurrency(
        "http://127.0.0.1:8080/v1/",
        undefined,
        fetchFn as unknown as typeof fetch,
      ),
    ).toBe(4);
  });

  it("is undefined when the server does not say", async () => {
    const fetchFn = routes({ "/v1/models": { data: [] } });
    expect(
      await serverConcurrency(
        "http://127.0.0.1:8000/v1/",
        undefined,
        fetchFn as unknown as typeof fetch,
      ),
    ).toBeUndefined();
  });
});
