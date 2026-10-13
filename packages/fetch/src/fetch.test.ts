import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Response } from "node-fetch";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchwithRequestOptions } from "./fetch.js";
import patchedFetch from "./node-fetch-patch.js";

vi.mock("./node-fetch-patch.js", () => ({ default: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("proxy bypass ports", () => {
  test.each([
    ["http:", "80", false],
    ["https:", "443", false],
    ["http:", "443", true],
    ["https:", "80", true],
  ])(
    "uses the effective port for %s and noProxy :%s",
    async (protocol, port, proxied) => {
      vi.stubEnv("NO_PROXY", "");
      vi.stubEnv("no_proxy", "");
      vi.mocked(patchedFetch).mockResolvedValue(new Response("ok"));
      const url = new URL(`${protocol}//example.com/`);
      const originalUrl = url.href;

      await fetchwithRequestOptions(url, undefined, {
        proxy: "http://127.0.0.1:8080",
        noProxy: [`example.com:${port}`],
      });

      const agent = vi.mocked(patchedFetch).mock.calls[0][1]?.agent;
      expect(
        agent instanceof HttpProxyAgent || agent instanceof HttpsProxyAgent,
      ).toBe(proxied);
      expect(url.href).toBe(originalUrl);
    },
  );
});
