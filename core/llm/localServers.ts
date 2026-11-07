import type { FetchedModel } from "./fetchModels.js";

/** An OpenAI-compatible server that usually runs on this machine. */
export interface LocalServerPreset {
  title: string;
  /** Includes the `/v1/` path the server serves the OpenAI API under. */
  apiBase: string;
}

/**
 * The default address of each common local server. llama.cpp's
 * `llama-server` (and Strata, llamafile and LocalAI, which keep its port)
 * comes first: 8080 is the most common local default.
 */
export const LOCAL_SERVER_PRESETS: LocalServerPreset[] = [
  { title: "llama.cpp / Strata", apiBase: "http://127.0.0.1:8080/v1/" },
  { title: "vLLM", apiBase: "http://127.0.0.1:8000/v1/" },
  { title: "LM Studio", apiBase: "http://127.0.0.1:1234/v1/" },
  { title: "Ollama", apiBase: "http://127.0.0.1:11434/v1/" },
  { title: "Lemonade", apiBase: "http://127.0.0.1:8000/api/v1/" },
  { title: "SGLang", apiBase: "http://127.0.0.1:30000/v1/" },
  { title: "text-generation-webui", apiBase: "http://127.0.0.1:5000/v1/" },
  { title: "KoboldCpp", apiBase: "http://127.0.0.1:5001/v1/" },
  { title: "Jan", apiBase: "http://127.0.0.1:1337/v1/" },
];

/**
 * Ports a second llama.cpp-style server usually takes: the next ones after
 * 8080. Detection tries them too, so a server moved off 8080 is still found.
 */
const EXTRA_LLAMACPP_PORTS = [
  8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089,
];

export interface DetectedLocalServer {
  title: string;
  apiBase: string;
  /** Empty when the server is up but has no model loaded, or needs a key. */
  models: FetchedModel[];
  /** The server refused the request without an API key. */
  needsKey?: boolean;
}

type FetchFn = typeof fetch;

/**
 * The context window a server reports for one `/v1/models` entry. Each
 * server names it differently: llama.cpp and Strata `meta.n_ctx`, vLLM
 * `max_model_len`, LM Studio `max_context_length` (or the loaded
 * `loaded_context_length`), OpenRouter and others `context_length`.
 */
export function contextLengthOf(entry: any): number | undefined {
  const candidates = [
    entry?.meta?.n_ctx,
    entry?.max_model_len,
    entry?.loaded_context_length,
    entry?.max_context_length,
    entry?.context_length,
    entry?.meta?.n_ctx_train,
  ];
  for (const value of candidates) {
    const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** False for entries that only produce something other than text (image models). */
function producesText(entry: any): boolean {
  const outputs = entry?.architecture?.output_modalities;
  return !Array.isArray(outputs) || outputs.includes("text");
}

/** True when an entry says it takes images (Strata, OpenRouter-style `architecture`). */
function takesImages(entry: any): boolean {
  const inputs = entry?.architecture?.input_modalities;
  return Array.isArray(inputs) && inputs.includes("image");
}

/** What a llama.cpp-style server's `/props` says the loaded model can do. */
export interface ServerCapabilities {
  /** The chat template takes tools (`chat_template_caps`). */
  tools?: boolean;
  /** The server has a vision projector loaded (`modalities.vision`). */
  images?: boolean;
  /**
   * One slot's context (`default_generation_settings.n_ctx`). A server with
   * several slots (`-np`) gives each a share of `-c`, so this, not the
   * model's or the server's whole window, is what one conversation gets.
   */
  contextLength?: number;
  /**
   * `/props` answered as llama.cpp's does, so the server takes llama.cpp's
   * request fields, such as `return_progress`.
   */
  llamaCppStyle?: boolean;
}

/**
 * Read `/props` at the server's root, as llama.cpp's `llama-server` and
 * Strata serve it. `chat_template_caps` comes from rendering the template
 * with tools, so it says whether tool calls can work, not whether the model
 * is good at them. Servers without `/props` (vLLM, LM Studio, Ollama) answer
 * nothing usable, and nothing is assumed.
 */
export async function serverCapabilities(
  apiBase: string,
  apiKey?: string,
  fetchFn: FetchFn = fetch,
  timeoutMs = 3000,
): Promise<ServerCapabilities> {
  try {
    const response = await fetchFn(new URL("/props", apiBase), {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return {};
    const props = await response.json();
    const caps = props?.chat_template_caps;
    const result: ServerCapabilities = {};
    if (caps && typeof caps === "object") {
      const tools = caps.supports_tools ?? caps.supports_tool_calls;
      if (typeof tools === "boolean") result.tools = tools;
    }
    if (typeof props?.modalities?.vision === "boolean") {
      result.images = props.modalities.vision;
    }
    const slotContext = Number(props?.default_generation_settings?.n_ctx);
    if (slotContext > 0) result.contextLength = slotContext;
    if (props?.default_generation_settings || props?.total_slots) {
      result.llamaCppStyle = true;
    }
    return result;
  } catch {
    return {};
  }
}

/** Addresses on this machine or the local network. */
export function isLocalApiBase(apiBase: string): boolean {
  let host: string;
  try {
    host = new URL(apiBase).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return false;
  }
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "host.docker.internal" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

const progressSupport = new Map<string, Promise<boolean>>();

/**
 * Whether the server at this address streams llama.cpp's `prompt_progress`
 * when a request asks with `return_progress: true` (llama.cpp, Strata).
 * Asked once per address with `/props`, and only for local addresses, so a
 * cloud API is never sent a field it does not know.
 */
export function streamsPromptProgress(
  apiBase: string | undefined,
  apiKey?: string,
  fetchFn: FetchFn = fetch,
): Promise<boolean> {
  if (!apiBase || !isLocalApiBase(apiBase)) return Promise.resolve(false);
  let known = progressSupport.get(apiBase);
  if (!known) {
    known = serverCapabilities(apiBase, apiKey, fetchFn).then(
      (caps) => !!caps.llamaCppStyle,
    );
    progressSupport.set(apiBase, known);
  }
  return known;
}

/** Forget what was learned about servers (tests). */
export function resetPromptProgressSupport(): void {
  progressSupport.clear();
}

/** llama.cpp's `prompt_progress`, as a streamed chunk carries it. */
export function promptProgressOf(
  chunk: any,
): import("../index.js").PromptProgress | undefined {
  const p = chunk?.prompt_progress;
  const total = Number(p?.total);
  if (!p || !(total > 0)) return undefined;
  return {
    total,
    cache: Number(p.cache) || 0,
    processed: Number(p.processed) || 0,
    timeMs: Number(p.time_ms) || 0,
  };
}

function withSlash(apiBase: string): string {
  return apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
}

class LocalServerError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function getModels(
  apiBase: string,
  apiKey: string | undefined,
  fetchFn: FetchFn,
  timeoutMs?: number,
): Promise<FetchedModel[]> {
  const listed = await getListedModels(apiBase, apiKey, fetchFn, timeoutMs);
  if (listed.length === 0) return listed;
  const [caps, native] = await Promise.all([
    serverCapabilities(apiBase, apiKey, fetchFn, timeoutMs),
    nativeModelInfo(apiBase, listed, fetchFn, timeoutMs),
  ]);
  return listed.map((m) => {
    const info = native.get(m.name) ?? {};
    const tools = info.tools ?? caps.tools;
    // One slot's context first: what a conversation gets on that server
    const contextLength =
      caps.contextLength ?? m.contextLength ?? info.contextLength;
    return {
      ...m,
      ...(contextLength ? { contextLength } : {}),
      ...(tools === undefined ? {} : { supportsTools: tools }),
      ...(m.supportsImages || caps.images || info.images
        ? { supportsImages: true }
        : {}),
    };
  });
}

interface NativeInfo {
  contextLength?: number;
  tools?: boolean;
  images?: boolean;
}

async function getJson(
  url: URL,
  fetchFn: FetchFn,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<any> {
  try {
    const response = await fetchFn(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
}

/** Most models one Detect or refresh asks Ollama about, one request each. */
const OLLAMA_SHOW_LIMIT = 20;

/**
 * What a server's own API adds to its OpenAI-compatible list, keyed by model
 * id. LM Studio (`/api/v0/models`): the context it loaded the model with, a
 * vision model (`type: "vlm"`) and tool use. Ollama (`/api/show`, `/api/ps`):
 * its `capabilities`, and the context of a model that is loaded. Ollama's
 * `model_info` context length is the trained maximum, not what Ollama will
 * run with (`num_ctx` is often much smaller), so it is not used: a window
 * larger than the server's would have prompts cut short without notice.
 */
async function nativeModelInfo(
  apiBase: string,
  models: FetchedModel[],
  fetchFn: FetchFn,
  timeoutMs = 3000,
): Promise<Map<string, NativeInfo>> {
  const info = new Map<string, NativeInfo>();
  const lmStudio = await getJson(
    new URL("/api/v0/models", apiBase),
    fetchFn,
    timeoutMs,
  );
  if (Array.isArray(lmStudio?.data)) {
    for (const m of lmStudio.data) {
      if (typeof m?.id !== "string") continue;
      const loaded = Number(m.loaded_context_length);
      const caps = Array.isArray(m.capabilities) ? m.capabilities : [];
      info.set(m.id, {
        ...(loaded > 0 ? { contextLength: loaded } : {}),
        ...(caps.includes("tool_use") ? { tools: true } : {}),
        ...(m.type === "vlm" ? { images: true } : {}),
      });
    }
    return info;
  }

  const running = await getJson(
    new URL("/api/ps", apiBase),
    fetchFn,
    timeoutMs,
  );
  if (!Array.isArray(running?.models)) return info; // not Ollama
  const loaded = new Map<string, number>();
  for (const m of running.models) {
    const n = Number(m?.context_length);
    if (typeof m?.name === "string" && n > 0) loaded.set(m.name, n);
  }
  await Promise.all(
    models.slice(0, OLLAMA_SHOW_LIMIT).map(async (m) => {
      const shown = await getJson(
        new URL("/api/show", apiBase),
        fetchFn,
        timeoutMs,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: m.name }),
        },
      );
      const caps: unknown[] = Array.isArray(shown?.capabilities)
        ? shown.capabilities
        : [];
      const contextLength = loaded.get(m.name);
      info.set(m.name, {
        ...(contextLength ? { contextLength } : {}),
        ...(shown ? { tools: caps.includes("tools") } : {}),
        ...(caps.includes("vision") ? { images: true } : {}),
      });
    }),
  );
  return info;
}

async function getListedModels(
  apiBase: string,
  apiKey: string | undefined,
  fetchFn: FetchFn,
  timeoutMs?: number,
): Promise<FetchedModel[]> {
  const response = await fetchFn(new URL("models", withSlash(apiBase)), {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  if (!response.ok) {
    throw new LocalServerError(
      `${response.status} ${response.statusText} from ${apiBase}models`,
      response.status,
    );
  }
  const data = await response.json();
  const entries: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  return entries
    .filter((m) => typeof m?.id === "string" && producesText(m))
    .map((m) => {
      const contextLength = contextLengthOf(m);
      return {
        name: m.id,
        modelId: m.id,
        ...(contextLength ? { contextLength } : {}),
        ...(takesImages(m) ? { supportsImages: true } : {}),
      };
    });
}

/**
 * The models an OpenAI-compatible server lists at `<apiBase>models`, with the
 * context window it reports for each, and tool and image support where the
 * server reports them (`/props` on llama.cpp-style servers).
 */
export async function listOpenAICompatibleModels(
  apiBase: string,
  apiKey?: string,
  fetchFn: FetchFn = fetch,
): Promise<FetchedModel[]> {
  return getModels(apiBase, apiKey, fetchFn);
}

/** True when the server at this address answers `/v1/status` as Strata. */
async function isStrata(
  apiBase: string,
  fetchFn: FetchFn,
  timeoutMs: number,
): Promise<boolean> {
  try {
    const response = await fetchFn(new URL("status", withSlash(apiBase)), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.service === "strata";
  } catch {
    return false;
  }
}

async function probe(
  preset: LocalServerPreset,
  fetchFn: FetchFn,
  timeoutMs: number,
): Promise<DetectedLocalServer | undefined> {
  try {
    const models = await getModels(
      preset.apiBase,
      undefined,
      fetchFn,
      timeoutMs,
    );
    const strata = await isStrata(preset.apiBase, fetchFn, timeoutMs);
    return { ...preset, title: strata ? "Strata" : preset.title, models };
  } catch (e) {
    if (
      e instanceof LocalServerError &&
      (e.status === 401 || e.status === 403)
    ) {
      return { ...preset, models: [], needsKey: true };
    }
    return undefined; // nothing listening, or not an OpenAI-compatible server
  }
}

/**
 * Look for OpenAI-compatible servers on this machine: every preset address,
 * plus ports 8081-8089 for a llama.cpp-style server moved off 8080. A port is
 * reported once, under the first preset that answers on it.
 */
export async function detectLocalServers(
  options: { fetchFn?: FetchFn; timeoutMs?: number } = {},
): Promise<DetectedLocalServer[]> {
  const { fetchFn = fetch, timeoutMs = 1500 } = options;
  const candidates: LocalServerPreset[] = [
    ...LOCAL_SERVER_PRESETS,
    ...EXTRA_LLAMACPP_PORTS.map((port) => ({
      title: "llama.cpp / Strata",
      apiBase: `http://127.0.0.1:${port}/v1/`,
    })),
  ];
  const results = await Promise.all(
    candidates.map((c) => probe(c, fetchFn, timeoutMs)),
  );
  const seenPorts = new Set<string>();
  const found: DetectedLocalServer[] = [];
  for (const server of results) {
    if (!server) continue;
    const port = new URL(server.apiBase).port;
    if (seenPorts.has(port)) continue;
    seenPorts.add(port);
    found.push(server);
  }
  return found;
}

/**
 * How many requests the server at this address serves at once, when it says:
 * Strata's `/v1/status` (`concurrency.serving`), else llama.cpp's `/props`
 * (`total_slots`). Requests past that wait in the server's queue, and on a
 * server whose cache holds one conversation per slot they also push each
 * other's prompts out of the cache. Undefined when the server does not say
 * (vLLM, LM Studio, Ollama, cloud APIs).
 */
export async function serverConcurrency(
  apiBase: string,
  apiKey?: string,
  fetchFn: FetchFn = fetch,
  timeoutMs = 2000,
): Promise<number | undefined> {
  const init: RequestInit = apiKey
    ? { headers: { Authorization: `Bearer ${apiKey}` } }
    : {};
  const status = await getJson(
    new URL("status", withSlash(apiBase)),
    fetchFn,
    timeoutMs,
    init,
  );
  const serving = Number(status?.concurrency?.serving);
  if (status?.service === "strata" && serving > 0) return serving;
  const props = await getJson(
    new URL("/props", apiBase),
    fetchFn,
    timeoutMs,
    init,
  );
  const slots = Number(props?.total_slots);
  return slots > 0 ? slots : undefined;
}
