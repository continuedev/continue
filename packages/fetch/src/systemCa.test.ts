import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import tls from "node:tls";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAgentForUrl, needsCustomAgent } from "./agent.js";
import { CertsCache, defaultUseSystemCa } from "./certs.js";
import { getAgentOptions } from "./getAgentOptions.js";

const SYSTEM_CERT =
  "-----BEGIN CERTIFICATE-----\nSYSTEMROOT\n-----END CERTIFICATE-----";
const originalEnv = process.env;
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;

function setPlatform(platform: string) {
  Object.defineProperty(process, "platform", { value: platform });
}

beforeEach(() => {
  process.env = { ...originalEnv };
  for (const k of [
    "HTTPS_PROXY",
    "https_proxy",
    "HTTP_PROXY",
    "http_proxy",
    "NO_PROXY",
    "no_proxy",
  ]) {
    delete process.env[k];
  }
  vi.spyOn(tls as any, "getCACertificates").mockReturnValue([SYSTEM_CERT]);
  CertsCache.getInstance().clear();
});

afterEach(() => {
  process.env = originalEnv;
  Object.defineProperty(process, "platform", originalPlatform);
  vi.restoreAllMocks();
  CertsCache.getInstance().clear();
});

describe("system CA", () => {
  test("is added when useSystemCa is true", async () => {
    const options = await getAgentOptions({ useSystemCa: true });
    expect(options.ca).toContain(SYSTEM_CERT);
  });

  test("is left out when useSystemCa is false, even on macOS", async () => {
    setPlatform("darwin");
    const options = await getAgentOptions({ useSystemCa: false });
    expect(options.ca).not.toContain(SYSTEM_CERT);
  });

  test.each(["darwin", "win32"])("is on by default on %s", async (platform) => {
    setPlatform(platform);
    expect(defaultUseSystemCa()).toBe(true);
    expect((await getAgentOptions()).ca).toContain(SYSTEM_CERT);
  });

  test("is off by default on Linux", async () => {
    setPlatform("linux");
    expect(defaultUseSystemCa()).toBe(false);
    expect((await getAgentOptions()).ca).not.toContain(SYSTEM_CERT);
  });

  test("falls back cleanly when Node has no tls.getCACertificates", async () => {
    vi.restoreAllMocks();
    const original = (tls as any).getCACertificates;
    (tls as any).getCACertificates = undefined;
    try {
      CertsCache.getInstance().clear();
      const options = await getAgentOptions({ useSystemCa: true });
      expect(options.ca.length).toBeGreaterThan(0); // bundled roots still present
    } finally {
      (tls as any).getCACertificates = original;
    }
  });

  test("does not duplicate certificates already trusted", async () => {
    const options = await getAgentOptions({ useSystemCa: true });
    expect(options.ca.filter((c: string) => c === SYSTEM_CERT)).toHaveLength(1);
  });
});

describe("createAgentForUrl", () => {
  const url = "https://bedrock-runtime.us-east-1.amazonaws.com";

  test("returns a plain agent carrying the CA settings when no proxy is set", async () => {
    const { agent, proxy } = await createAgentForUrl(url, {
      useSystemCa: true,
    });
    expect(proxy).toBeUndefined();
    expect(agent).not.toBeInstanceOf(HttpsProxyAgent);
    expect((agent as any).options.ca).toContain(SYSTEM_CERT);
  });

  test("uses requestOptions.proxy", async () => {
    const { agent, proxy } = await createAgentForUrl(url, {
      proxy: "http://proxy.corp:3128",
    });
    expect(proxy).toBe("http://proxy.corp:3128");
    expect(agent).toBeInstanceOf(HttpsProxyAgent);
  });

  test("picks up HTTPS_PROXY from the environment", async () => {
    process.env.HTTPS_PROXY = "http://envproxy:8080";
    const { agent } = await createAgentForUrl(url);
    expect(agent).toBeInstanceOf(HttpsProxyAgent);
  });

  test("bypasses the proxy for noProxy and NO_PROXY hosts", async () => {
    const byOption = await createAgentForUrl(url, {
      proxy: "http://proxy:1",
      noProxy: ["*.amazonaws.com"],
    });
    expect(byOption.agent).not.toBeInstanceOf(HttpsProxyAgent);

    process.env.HTTPS_PROXY = "http://envproxy:8080";
    process.env.NO_PROXY = "bedrock-runtime.us-east-1.amazonaws.com";
    const byEnv = await createAgentForUrl(url);
    expect(byEnv.agent).not.toBeInstanceOf(HttpsProxyAgent);
  });

  test("uses an HTTP proxy agent for http URLs", async () => {
    const { agent } = await createAgentForUrl("http://localhost:1234", {
      proxy: "http://proxy:1",
    });
    expect(agent).toBeInstanceOf(HttpProxyAgent);
  });

  test("passes verifySsl through", async () => {
    const { agent } = await createAgentForUrl(url, { verifySsl: false });
    expect((agent as any).options.rejectUnauthorized).toBe(false);
  });
});

describe("needsCustomAgent", () => {
  const url = "https://bedrock-runtime.us-east-1.amazonaws.com";

  test("is false for a plain Linux setup", () => {
    expect(needsCustomAgent(url, undefined)).toBe(false);
    expect(needsCustomAgent(url, { timeout: 5 })).toBe(false);
  });

  test.each([
    ["caBundlePath", { caBundlePath: "/etc/ca.pem" }],
    ["clientCertificate", { clientCertificate: { cert: "c", key: "k" } }],
    ["verifySsl=false", { verifySsl: false }],
    ["useSystemCa", { useSystemCa: true }],
    ["proxy", { proxy: "http://p:1" }],
  ])("is true with %s", (_name, opts) => {
    expect(needsCustomAgent(url, opts as any)).toBe(true);
  });

  test("is true when the platform trusts the system store by default", () => {
    expect(needsCustomAgent(url, undefined, true)).toBe(true);
    expect(needsCustomAgent(url, { useSystemCa: false }, true)).toBe(false);
  });

  test("a proxied host that is bypassed does not need a custom agent", () => {
    expect(
      needsCustomAgent(url, {
        proxy: "http://p:1",
        noProxy: [".amazonaws.com"],
      }),
    ).toBe(false);
  });

  test("an environment proxy counts", () => {
    process.env.HTTPS_PROXY = "http://envproxy:8080";
    expect(needsCustomAgent(url, undefined)).toBe(true);
  });
});
