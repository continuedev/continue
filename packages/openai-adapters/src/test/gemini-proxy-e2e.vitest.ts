import http from "node:http";
import { AddressInfo } from "node:net";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GeminiApi } from "../apis/Gemini.js";
import { sseChunk } from "./gemini-test-helpers.js";

/**
 * End-to-end proof for the proxy path: the REAL @google/genai SDK, the REAL
 * customFetch/fetchwithRequestOptions stack (no mocks anywhere), a real local
 * HTTP forward proxy, and a stub Gemini server emitting SSE. Verifies the
 * node-fetch Response adaptation streams through the SDK's own parser.
 */

let geminiServer: http.Server;
let proxyServer: http.Server;
let geminiPort: number;
let proxyPort: number;

/** Requests the stub Gemini server actually received. */
const geminiRequests: {
  url: string;
  apiKey: string | undefined;
  customHeader: string | undefined;
}[] = [];
/** Number of requests that transited the proxy. */
let proxiedRequests = 0;

beforeAll(async () => {
  geminiServer = http.createServer((req, res) => {
    geminiRequests.push({
      url: req.url ?? "",
      apiKey: req.headers["x-goog-api-key"] as string | undefined,
      customHeader: req.headers["x-custom-gateway"] as string | undefined,
    });
    if ((req.url ?? "").includes("mbedContent")) {
      // embedContent / batchEmbedContents — Google's real response shape
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ embeddings: [{ values: [0.25, 0.75] }] }));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(sseChunk("Hello "));
    res.write(sseChunk("from the proxied stub", "STOP"));
    res.end();
  });
  await new Promise<void>((resolve) =>
    geminiServer.listen(0, "127.0.0.1", resolve),
  );
  geminiPort = (geminiServer.address() as AddressInfo).port;

  proxyServer = makeForwardProxy(() => {
    proxiedRequests += 1;
  });
  await new Promise<void>((resolve) =>
    proxyServer.listen(0, "127.0.0.1", resolve),
  );
  proxyPort = (proxyServer.address() as AddressInfo).port;
});

/**
 * Minimal HTTP forward proxy: receives absolute-URI requests, forwards them,
 * pipes the response back. onRequest fires for every transit — the
 * discriminating signal for which proxy (if any) a request dialed.
 */
function makeForwardProxy(
  onRequest: (req: http.IncomingMessage) => void,
): http.Server {
  return http.createServer((req, res) => {
    onRequest(req);
    const target = new URL(req.url ?? "");
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    req.pipe(upstream);
  });
}

afterAll(async () => {
  await new Promise((resolve) => geminiServer.close(resolve));
  await new Promise((resolve) => proxyServer.close(resolve));
});

describe("Gemini streaming through a real local proxy (no mocks)", () => {
  beforeEach(() => {
    // Deterministic regardless of the machine's ambient proxy environment;
    // individual tests re-stub what they need.
    vi.stubEnv("HTTP_PROXY", "");
    vi.stubEnv("http_proxy", "");
    vi.stubEnv("HTTPS_PROXY", "");
    vi.stubEnv("https_proxy", "");
    vi.stubEnv("NO_PROXY", "");
    vi.stubEnv("no_proxy", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("streams SSE chunks via the real SDK, customFetch, and proxy", async () => {
    const proxiedBefore = proxiedRequests;
    const requestsBefore = geminiRequests.length;
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "stub-key",
      apiBase: `http://127.0.0.1:${geminiPort}/v1beta/`,
      requestOptions: {
        proxy: `http://127.0.0.1:${proxyPort}`,
      },
    });

    let content = "";
    for await (const chunk of api.chatCompletionStream(
      {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      new AbortController().signal,
    )) {
      content += chunk.choices[0]?.delta?.content ?? "";
    }

    expect(content).toBe("Hello from the proxied stub");
    expect(proxiedRequests).toBe(proxiedBefore + 1);
    const observed = geminiRequests[requestsBefore];
    expect(observed.apiKey).toBe("stub-key");
    expect(observed.url).toContain(":streamGenerateContent");
  });

  it("delivers custom requestOptions.headers to the wire", async () => {
    const before = geminiRequests.length;
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "stub-key",
      apiBase: `http://127.0.0.1:${geminiPort}/v1beta/`,
      requestOptions: {
        proxy: `http://127.0.0.1:${proxyPort}`,
        headers: { "x-custom-gateway": "gw-credential-123" },
      },
    });

    for await (const _chunk of api.chatCompletionStream(
      {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      new AbortController().signal,
    )) {
      // drain
    }

    const observed = geminiRequests[before];
    expect(observed.customHeader).toBe("gw-credential-123");
  });

  it("uses an environment proxy when no config proxy is set", async () => {
    // The corporate case: proxy exists only as env vars (why a user's plain
    // Python sample works). No requestOptions at all.
    vi.stubEnv("HTTP_PROXY", `http://127.0.0.1:${proxyPort}`);
    vi.stubEnv("NO_PROXY", "");
    vi.stubEnv("no_proxy", "");

    const proxiedBefore = proxiedRequests;
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "stub-key",
      apiBase: `http://127.0.0.1:${geminiPort}/v1beta/`,
    });

    let content = "";
    for await (const chunk of api.chatCompletionStream(
      {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      new AbortController().signal,
    )) {
      content += chunk.choices[0]?.delta?.content ?? "";
    }

    expect(content).toBe("Hello from the proxied stub");
    expect(proxiedRequests).toBe(proxiedBefore + 1);
  });

  it("delivers custom headers alongside an environment proxy", async () => {
    vi.stubEnv("HTTP_PROXY", `http://127.0.0.1:${proxyPort}`);
    const proxiedBefore = proxiedRequests;
    const requestsBefore = geminiRequests.length;
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "stub-key",
      apiBase: `http://127.0.0.1:${geminiPort}/v1beta/`,
      requestOptions: {
        headers: { "x-custom-gateway": "gw-credential-456" },
      },
    });

    for await (const _chunk of api.chatCompletionStream(
      {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      new AbortController().signal,
    )) {
      // drain
    }

    // Env proxy engages the wrapper AND custom headers still reach the wire.
    expect(proxiedRequests).toBe(proxiedBefore + 1);
    expect(geminiRequests[requestsBefore].customHeader).toBe(
      "gw-credential-456",
    );
  });

  it("goes direct when NO_PROXY covers the target host", async () => {
    vi.stubEnv("HTTP_PROXY", `http://127.0.0.1:${proxyPort}`);
    vi.stubEnv("NO_PROXY", "127.0.0.1");

    const proxiedBefore = proxiedRequests;
    const requestsBefore = geminiRequests.length;
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "stub-key",
      apiBase: `http://127.0.0.1:${geminiPort}/v1beta/`,
    });

    let content = "";
    for await (const chunk of api.chatCompletionStream(
      {
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
      new AbortController().signal,
    )) {
      content += chunk.choices[0]?.delta?.content ?? "";
    }

    expect(content).toBe("Hello from the proxied stub");
    expect(proxiedRequests).toBe(proxiedBefore); // proxy NOT used
    expect(geminiRequests.length).toBe(requestsBefore + 1); // server reached directly
  });

  it("prefers the config proxy over an environment proxy", async () => {
    // Two REAL proxies: env points at one, config at the other. The
    // hit-counters discriminate which was actually dialed — directly
    // exercising getProxy()'s config-first precedence at the wire.
    let envProxyHits = 0;
    const envProxy = makeForwardProxy(() => {
      envProxyHits += 1;
    });
    await new Promise<void>((resolve) =>
      envProxy.listen(0, "127.0.0.1", resolve),
    );
    const envProxyPort = (envProxy.address() as AddressInfo).port;

    try {
      vi.stubEnv("HTTP_PROXY", `http://127.0.0.1:${envProxyPort}`);

      const configProxiedBefore = proxiedRequests;
      const api = new GeminiApi({
        provider: "gemini",
        apiKey: "stub-key",
        apiBase: `http://127.0.0.1:${geminiPort}/v1beta/`,
        requestOptions: {
          proxy: `http://127.0.0.1:${proxyPort}`,
        },
      });

      let content = "";
      for await (const chunk of api.chatCompletionStream(
        {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: "hi" }],
          stream: true,
        },
        new AbortController().signal,
      )) {
        content += chunk.choices[0]?.delta?.content ?? "";
      }

      expect(content).toBe("Hello from the proxied stub");
      expect(proxiedRequests).toBe(configProxiedBefore + 1); // config proxy dialed
      expect(envProxyHits).toBe(0); // env proxy never touched
    } finally {
      await new Promise((resolve) => envProxy.close(resolve));
    }
  });

  it("isolates proxy routing and credentials between two concurrent configs", async () => {
    // The security-critical case: two GeminiApi configs, each behind its own
    // proxy with its own gateway credential, run concurrently. Each request
    // must stay on its own proxy carrying only its own credential — never
    // config A's credential riding config B's request (the leak the swap
    // mutex prevents).
    const proxyAHeaders: (string | undefined)[] = [];
    const proxyBHeaders: (string | undefined)[] = [];
    const proxyA = makeForwardProxy((req) =>
      proxyAHeaders.push(req.headers["x-custom-gateway"] as string | undefined),
    );
    const proxyB = makeForwardProxy((req) =>
      proxyBHeaders.push(req.headers["x-custom-gateway"] as string | undefined),
    );
    await new Promise<void>((r) => proxyA.listen(0, "127.0.0.1", r));
    await new Promise<void>((r) => proxyB.listen(0, "127.0.0.1", r));
    const portA = (proxyA.address() as AddressInfo).port;
    const portB = (proxyB.address() as AddressInfo).port;

    async function drain(port: number, credential: string): Promise<string> {
      const api = new GeminiApi({
        provider: "gemini",
        apiKey: "stub-key",
        apiBase: `http://127.0.0.1:${geminiPort}/v1beta/`,
        requestOptions: {
          proxy: `http://127.0.0.1:${port}`,
          headers: { "x-custom-gateway": credential },
        },
      });
      let content = "";
      for await (const chunk of api.chatCompletionStream(
        {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: "hi" }],
          stream: true,
        },
        new AbortController().signal,
      )) {
        content += chunk.choices[0]?.delta?.content ?? "";
      }
      return content;
    }

    try {
      const [ca, cb] = await Promise.all([
        drain(portA, "cred-A"),
        drain(portB, "cred-B"),
      ]);

      // Both streams completed concurrently (Promise.all) — serialization did
      // not hold across body consumption.
      expect(ca).toBe("Hello from the proxied stub");
      expect(cb).toBe("Hello from the proxied stub");
      // Each request transited ONLY its own proxy, carrying ONLY its own
      // credential — zero cross-contamination.
      expect(proxyAHeaders).toEqual(["cred-A"]);
      expect(proxyBHeaders).toEqual(["cred-B"]);
    } finally {
      await new Promise((r) => proxyA.close(r));
      await new Promise((r) => proxyB.close(r));
    }
  });

  it("routes embed through the same proxy and parses Google's real shape", async () => {
    const proxiedBefore = proxiedRequests;
    const requestsBefore = geminiRequests.length;
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "stub-key",
      apiBase: `http://127.0.0.1:${geminiPort}/v1beta/`,
      requestOptions: {
        proxy: `http://127.0.0.1:${proxyPort}`,
      },
    });

    const result = await api.embed({
      model: "gemini-embedding-001",
      input: ["hello"],
    });

    expect(proxiedRequests).toBe(proxiedBefore + 1);
    expect(geminiRequests[requestsBefore].url).toContain("mbedContent");
    expect(result.data[0].embedding).toEqual([0.25, 0.75]);
  });
});

describe("Gemini requestOptions.timeout end-to-end (no mocks)", () => {
  let slowServer: http.Server;
  let slowPort: number;

  beforeAll(async () => {
    // Never responds within the test's timeout window — forces the SDK's
    // own timeout/abort path to fire.
    slowServer = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.end();
      }, 5000);
    });
    await new Promise<void>((r) => slowServer.listen(0, "127.0.0.1", r));
    slowPort = (slowServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((r) => slowServer.close(r));
  });

  it("aborts a chat call when the configured timeout elapses", async () => {
    const api = new GeminiApi({
      provider: "gemini",
      apiKey: "stub-key",
      apiBase: `http://127.0.0.1:${slowPort}/v1beta/`,
      requestOptions: { timeout: 100 },
    });

    const started = Date.now();
    let threw = false;
    try {
      for await (const _chunk of api.chatCompletionStream(
        {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: "hi" }],
          stream: true,
        },
        new AbortController().signal,
      )) {
        // never arrives
      }
    } catch {
      threw = true;
    }

    // The call aborted from the timeout, not by waiting out the 5s server.
    expect(threw).toBe(true);
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
