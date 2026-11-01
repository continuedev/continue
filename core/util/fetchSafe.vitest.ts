import { createServer } from "node:http";

import { describe, expect, test, vi } from "vitest";

import { assertPublicUrl, isPublicIp, safeFetch } from "./fetchSafe";

function stubResponse(opts: {
  status: number;
  location?: string;
  url?: string;
  text?: string;
}) {
  return {
    status: opts.status,
    url: opts.url ?? "",
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "location" ? (opts.location ?? null) : null,
    },
    text: async () => opts.text ?? "",
  };
}

describe("isPublicIp", () => {
  test("accepts public addresses", () => {
    expect(isPublicIp("93.184.216.34")).toBe(true);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
  });

  test("rejects loopback, private, link-local, CGNAT, and special ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.9",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "192.0.2.1",
      "198.51.100.2",
      "203.0.113.3",
      "224.0.0.1",
    ]) {
      expect(isPublicIp(ip)).toBe(false);
    }
  });

  test("rejects non-public IPv6", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "2001:db8::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPublicIp(ip)).toBe(false);
    }
  });
});

describe("assertPublicUrl", () => {
  test("accepts a public IP literal", async () => {
    await expect(
      assertPublicUrl("http://93.184.216.34/"),
    ).resolves.toBeInstanceOf(URL);
  });

  test("rejects private IP literals without fetching", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/")).rejects.toThrow(
      "non-public",
    );
    await expect(assertPublicUrl("http://169.254.169.254/")).rejects.toThrow(
      "non-public",
    );
  });

  test("rejects localhost via resolution", async () => {
    await expect(assertPublicUrl("http://localhost/")).rejects.toThrow(
      "non-public",
    );
  });

  test("rejects non-HTTP schemes", async () => {
    await expect(assertPublicUrl("ftp://93.184.216.34/")).rejects.toThrow(
      "non-HTTP",
    );
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(
      "non-HTTP",
    );
  });
});

describe("safeFetch", () => {
  test("passes a public URL through with manual redirect mode", async () => {
    const fetchFn = vi.fn(async (_url: string | URL, _init?: any) =>
      stubResponse({ status: 200 }),
    );
    const resp = await safeFetch(fetchFn, "http://93.184.216.34/");
    expect(resp.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1].redirect).toBe("manual");
  });

  test("never calls fetch for a private target", async () => {
    const fetchFn = vi.fn(async () => stubResponse({ status: 200 }));
    await expect(safeFetch(fetchFn, "http://127.0.0.1/admin")).rejects.toThrow(
      "non-public",
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("refuses a redirect to a private address", async () => {
    const fetchFn = vi.fn(async (url: string | URL) => {
      if (new URL(url).hostname === "93.184.216.34") {
        return stubResponse({ status: 302, location: "http://127.0.0.1/" });
      }
      return stubResponse({ status: 200 });
    });
    await expect(safeFetch(fetchFn, "http://93.184.216.34/")).rejects.toThrow(
      "non-public",
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("follows a redirect to a public address", async () => {
    const fetchFn = vi.fn(async (url: string | URL) => {
      if (new URL(url).hostname === "93.184.216.34") {
        return stubResponse({ status: 302, location: "http://8.8.8.8/" });
      }
      return stubResponse({ status: 200, text: "ok" });
    });
    const resp = await safeFetch(fetchFn, "http://93.184.216.34/");
    expect(resp.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test("refuses content when the transport followed to a private URL", async () => {
    const fetchFn = vi.fn(async () =>
      stubResponse({ status: 200, url: "http://127.0.0.1/x" }),
    );
    await expect(safeFetch(fetchFn, "http://93.184.216.34/")).rejects.toThrow(
      "non-public",
    );
  });

  test("stops after too many redirects", async () => {
    const fetchFn = vi.fn(async () =>
      stubResponse({ status: 302, location: "http://8.8.8.8/" }),
    );
    await expect(safeFetch(fetchFn, "http://93.184.216.34/")).rejects.toThrow(
      "Too many redirects",
    );
  });

  test("makes no request to a local server URL", async () => {
    let requests = 0;
    const server = createServer(() => {
      requests++;
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as { port: number }).port;
    try {
      await expect(
        safeFetch(fetch, `http://127.0.0.1:${port}/`),
      ).rejects.toThrow("non-public");
      expect(requests).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
