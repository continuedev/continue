import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { nativeFetch } from "../util/nativeFetch.js";

const fetchwithRequestOptionsMock = vi.fn();
vi.mock("@continuedev/fetch", async () => {
  const actual = await vi.importActual("@continuedev/fetch");
  return {
    ...actual,
    fetchwithRequestOptions: (...args: unknown[]) =>
      fetchwithRequestOptionsMock(...args),
  };
});

/** Minimal stand-in for a node-fetch Response: Node Readable body, no getReader. */
function nodeFetchStyleResponse(
  chunks: string[],
  init: { status?: number; statusText?: string; headers?: [string, string][] },
) {
  return {
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    headers: new Map(init.headers ?? []),
    body:
      chunks.length > 0
        ? Readable.from(chunks.map((chunk) => Buffer.from(chunk)))
        : null,
  };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe("adaptToNativeResponse", () => {
  it("adapts a node-fetch-style Response so its body supports getReader()", async () => {
    const { adaptToNativeResponse } = await import(
      "../util/requestOptionsFetch.js"
    );

    const adapted = adaptToNativeResponse(
      nodeFetchStyleResponse(
        ['data: {"text":"hel', 'lo"}\n\n', "data: [DONE]\n\n"],
        {
          status: 200,
          statusText: "OK",
          headers: [["content-type", "text/event-stream"]],
        },
      ),
    );

    expect(adapted).toBeInstanceOf(Response);
    expect(adapted.status).toBe(200);
    expect(adapted.statusText).toBe("OK");
    expect(adapted.headers.get("content-type")).toBe("text/event-stream");
    expect(typeof adapted.body?.getReader).toBe("function");
    await expect(readAll(adapted.body!)).resolves.toBe(
      'data: {"text":"hello"}\n\ndata: [DONE]\n\n',
    );
  });

  it("produces a null body for null-body statuses", async () => {
    const { adaptToNativeResponse } = await import(
      "../util/requestOptionsFetch.js"
    );

    const adapted = adaptToNativeResponse(
      nodeFetchStyleResponse([], {
        status: 204,
        statusText: "No Content",
      }),
    );

    expect(adapted.status).toBe(204);
    expect(adapted.body).toBeNull();
  });
});

describe("withRequestOptionsFetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("routes fetch through customFetch when proxy is configured, then restores", async () => {
    const { withRequestOptionsFetch } = await import(
      "../util/requestOptionsFetch.js"
    );

    fetchwithRequestOptionsMock.mockResolvedValue(
      nodeFetchStyleResponse(["ok"], { status: 200, statusText: "OK" }),
    );

    const before = globalThis.fetch;
    const requestOptions = { proxy: "http://proxy.example.com:8080" };

    const result = await withRequestOptionsFetch(requestOptions, async () => {
      const response = await globalThis.fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
      );
      return response;
    });

    expect(fetchwithRequestOptionsMock).toHaveBeenCalledTimes(1);
    expect(fetchwithRequestOptionsMock.mock.calls[0][0].toString()).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models",
    );
    expect(fetchwithRequestOptionsMock.mock.calls[0][2]).toEqual(
      requestOptions,
    );
    expect(result).toBeInstanceOf(Response);
    expect(typeof result.body?.getReader).toBe("function");
    expect(globalThis.fetch).toBe(before);
  });

  function clearProxyEnv(): void {
    vi.stubEnv("HTTPS_PROXY", "");
    vi.stubEnv("https_proxy", "");
    vi.stubEnv("HTTP_PROXY", "");
    vi.stubEnv("http_proxy", "");
  }

  it("uses the native-fetch fast path when no proxy/TLS options are set", async () => {
    clearProxyEnv();
    const { withRequestOptionsFetch } = await import(
      "../util/requestOptionsFetch.js"
    );

    // headers/timeout alone are handled via SDK httpOptions — not this wrapper
    const seen: (typeof globalThis.fetch)[] = [];
    await withRequestOptionsFetch(
      { headers: { "x-api-key": "k" }, timeout: 5 },
      async () => {
        seen.push(globalThis.fetch);
      },
    );
    await withRequestOptionsFetch(undefined, async () => {
      seen.push(globalThis.fetch);
    });

    expect(seen).toEqual([nativeFetch, nativeFetch]);
    expect(fetchwithRequestOptionsMock).not.toHaveBeenCalled();
  });

  it("engages the wrapper when only an environment proxy is set", async () => {
    clearProxyEnv();
    vi.stubEnv("HTTPS_PROXY", "http://proxy.corp.example:8080");
    const { withRequestOptionsFetch } = await import(
      "../util/requestOptionsFetch.js"
    );

    let observedFetch: typeof globalThis.fetch | undefined;
    await withRequestOptionsFetch(undefined, async () => {
      observedFetch = globalThis.fetch;
    });

    // Corporate env-var proxies (the reason a user's Python sample works
    // while Continue fails) must route through customFetch like every
    // other provider — not the native fast path.
    expect(observedFetch).toBeDefined();
    expect(observedFetch).not.toBe(nativeFetch);
  });

  it("engages the wrapper for lowercase http_proxy too", async () => {
    clearProxyEnv();
    vi.stubEnv("http_proxy", "http://proxy.corp.example:8080");
    const { withRequestOptionsFetch } = await import(
      "../util/requestOptionsFetch.js"
    );

    let observedFetch: typeof globalThis.fetch | undefined;
    await withRequestOptionsFetch(undefined, async () => {
      observedFetch = globalThis.fetch;
    });

    expect(observedFetch).not.toBe(nativeFetch);
  });

  it("restores all four swapped globals even when the callback throws", async () => {
    const { withRequestOptionsFetch } = await import(
      "../util/requestOptionsFetch.js"
    );

    // Sentinels make every restore line falsifiable: the ambient globals
    // already equal the native classes the wrapper installs, so asserting on
    // the ambient values could never catch a deleted restore line. With
    // sentinels installed first, the try block replaces them with natives and
    // ONLY a working finally can bring each sentinel back.
    const sentinelFetch: typeof globalThis.fetch = async () => new Response();
    class SentinelResponse extends Response {}
    class SentinelRequest extends Request {}
    class SentinelHeaders extends Headers {}

    const ambient = {
      fetch: globalThis.fetch,
      Response: globalThis.Response,
      Request: globalThis.Request,
      Headers: globalThis.Headers,
    };
    try {
      globalThis.fetch = sentinelFetch;
      globalThis.Response = SentinelResponse;
      globalThis.Request = SentinelRequest;
      globalThis.Headers = SentinelHeaders;

      await expect(
        withRequestOptionsFetch({ verifySsl: false }, async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      expect(globalThis.fetch).toBe(sentinelFetch);
      expect(globalThis.Response).toBe(SentinelResponse);
      expect(globalThis.Request).toBe(SentinelRequest);
      expect(globalThis.Headers).toBe(SentinelHeaders);
    } finally {
      globalThis.fetch = ambient.fetch;
      globalThis.Response = ambient.Response;
      globalThis.Request = ambient.Request;
      globalThis.Headers = ambient.Headers;
    }
  });

  it("serializes concurrent swaps so one config never observes another's fetch", async () => {
    const { withRequestOptionsFetch } = await import(
      "../util/requestOptionsFetch.js"
    );
    fetchwithRequestOptionsMock.mockResolvedValue(
      nodeFetchStyleResponse(["ok"], { status: 200, statusText: "OK" }),
    );

    // Each call records the fetch identity it observes across an await point
    // (yielding to the event loop mid-window). Without serialization the two
    // swaps interleave and each sees the OTHER's wrapped fetch installed.
    async function run(tag: string): Promise<(typeof globalThis.fetch)[]> {
      const seen: (typeof globalThis.fetch)[] = [];
      await withRequestOptionsFetch(
        { proxy: `http://proxy-${tag}.example:8080` },
        async () => {
          seen.push(globalThis.fetch);
          // Yield twice so a sibling swap has every chance to overwrite.
          await Promise.resolve();
          await Promise.resolve();
          seen.push(globalThis.fetch);
        },
      );
      return seen;
    }

    const [a, b] = await Promise.all([run("a"), run("b")]);

    // Within each call, the fetch identity observed before and after the
    // await must be stable — never swapped out from under it by the sibling.
    expect(a[0]).toBe(a[1]);
    expect(b[0]).toBe(b[1]);
    // And the two calls must have observed DIFFERENT wrapped fetches
    // (each bound to its own requestOptions), never a shared one.
    expect(a[0]).not.toBe(b[0]);
  });

  it("releases the swap lock at establishment, not during stream consumption", async () => {
    const { withRequestOptionsFetch } = await import(
      "../util/requestOptionsFetch.js"
    );
    fetchwithRequestOptionsMock.mockResolvedValue(
      nodeFetchStyleResponse(["ok"], { status: 200, statusText: "OK" }),
    );

    // `fn` resolves when the SDK stream is ESTABLISHED; body iteration happens
    // afterward, outside withRequestOptionsFetch. Model that: config A's
    // establishment resolves immediately, then a pending "stream" continues.
    // Config B must be able to acquire the lock and run WHILE A's stream is
    // still in flight — proving the lock covers only establishment.
    let bRanWhileAStreaming = false;
    let resolveAStream!: () => void;
    const aStreamDone = new Promise<void>((r) => {
      resolveAStream = r;
    });

    const aChain = withRequestOptionsFetch(
      { proxy: "http://proxy-a.example:8080" },
      async () => {
        /* establishment completes — lock should release here */
      },
    ).then(() => aStreamDone); // post-establishment stream consumption

    await withRequestOptionsFetch(
      { proxy: "http://proxy-b.example:8080" },
      async () => {
        bRanWhileAStreaming = true;
      },
    );

    // B completed while A's stream is still pending (aStreamDone unresolved).
    expect(bRanWhileAStreaming).toBe(true);

    resolveAStream();
    await aChain;
  });
});

describe("GeminiApi SDK-call fetch routing", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("runs generateContentStream under the adapted fetch when proxy is set", async () => {
    vi.doMock("@google/genai", () => {
      const generateContentStream = vi.fn().mockImplementation(async () => {
        // Capture the fetch active DURING the SDK call
        capturedFetch = globalThis.fetch;
        return (async function* () {})();
      });
      return {
        GoogleGenAI: vi.fn().mockImplementation(() => ({
          models: { generateContentStream },
        })),
      };
    });
    let capturedFetch: typeof globalThis.fetch | undefined;

    const { GeminiApi } = await import("../apis/Gemini.js");
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "k",
      requestOptions: { proxy: "http://proxy.example.com:8080" },
    });

    const stream = api.chatCompletionStream(
      {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      new AbortController().signal,
    );
    for await (const _chunk of stream) {
      // drain
    }

    expect(capturedFetch).toBeDefined();
    expect(capturedFetch).not.toBe(nativeFetch);
    expect(globalThis.fetch).not.toBe(capturedFetch);
  });
});
