import { HttpsProxyAgent } from "https-proxy-agent";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fetchwithRequestOptions } from "./fetch.js";
import patchedFetch from "./node-fetch-patch.js";

vi.mock("./node-fetch-patch.js", () => ({
  default: vi.fn(),
}));

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.http_proxy;
  delete process.env.https_proxy;

  vi.mocked(patchedFetch).mockReset();
  vi.mocked(patchedFetch).mockResolvedValue({
    ok: true,
    headers: { get: () => undefined },
  } as any);
});

afterEach(() => {
  process.env = originalEnv;
});

test("fetchwithRequestOptions uses an HttpsProxyAgent configured with requestOptions.proxy", async () => {
  await fetchwithRequestOptions("https://example.com/api", undefined, {
    proxy: "http://proxy.example.com:8080",
  });

  expect(patchedFetch).toHaveBeenCalledTimes(1);
  const [, init] = vi.mocked(patchedFetch).mock.calls[0];
  const agent = (init as any).agent;

  expect(agent).toBeInstanceOf(HttpsProxyAgent);
  expect(agent.proxy.href).toBe("http://proxy.example.com:8080/");
});

test("fetchwithRequestOptions disables TLS verification when requestOptions.verifySsl is false", async () => {
  await fetchwithRequestOptions("https://example.com/api", undefined, {
    verifySsl: false,
  });

  const [, init] = vi.mocked(patchedFetch).mock.calls[0];
  const agent = (init as any).agent;

  expect(agent.options.rejectUnauthorized).toBe(false);
});

test("fetchwithRequestOptions honors proxy and disabled TLS verification together", async () => {
  await fetchwithRequestOptions("https://example.com/api", undefined, {
    proxy: "http://proxy.example.com:8080",
    verifySsl: false,
  });

  const [, init] = vi.mocked(patchedFetch).mock.calls[0];
  const agent = (init as any).agent;

  expect(agent).toBeInstanceOf(HttpsProxyAgent);
  expect(agent.proxy.href).toBe("http://proxy.example.com:8080/");
  expect(agent.connectOpts.rejectUnauthorized).toBe(false);
});
