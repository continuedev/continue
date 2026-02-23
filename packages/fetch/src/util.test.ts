import { afterEach, expect, test, vi } from "vitest";
import {
  getProxyFromEnv,
  patternMatchesHostname,
  shouldBypassProxy,
} from "./util.js";

// Reset environment variables after each test
afterEach(() => {
  vi.resetModules();
  process.env = {};
});

// Tests for getProxyFromEnv
test("getProxyFromEnv returns undefined when no proxy is set", () => {
  expect(getProxyFromEnv("http:")).toBeUndefined();
  expect(getProxyFromEnv("https:")).toBeUndefined();
});

test("getProxyFromEnv returns HTTP_PROXY for http protocol", () => {
  process.env.HTTP_PROXY = "http://proxy.example.com";
  expect(getProxyFromEnv("http:")).toBe("http://proxy.example.com");
});

test("getProxyFromEnv returns lowercase http_proxy for http protocol", () => {
  process.env.http_proxy = "http://proxy.example.com";
  expect(getProxyFromEnv("http:")).toBe("http://proxy.example.com");
});

test("getProxyFromEnv prefers HTTP_PROXY over http_proxy for http protocol", () => {
  process.env.HTTP_PROXY = "http://upper.example.com";
  process.env.http_proxy = "http://lower.example.com";
  expect(getProxyFromEnv("http:")).toBe("http://upper.example.com");
});

test("getProxyFromEnv returns HTTPS_PROXY for https protocol", () => {
  process.env.HTTPS_PROXY = "https://secure.example.com";
  expect(getProxyFromEnv("https:")).toBe("https://secure.example.com");
});

test("getProxyFromEnv returns lowercase https_proxy for https protocol", () => {
  process.env.https_proxy = "https://secure.example.com";
  expect(getProxyFromEnv("https:")).toBe("https://secure.example.com");
});

test("getProxyFromEnv falls back to HTTP_PROXY for https protocol when HTTPS_PROXY is not set", () => {
  process.env.HTTP_PROXY = "http://fallback.example.com";
  expect(getProxyFromEnv("https:")).toBe("http://fallback.example.com");
});

test("getProxyFromEnv prefers HTTPS_PROXY over other env vars for https protocol", () => {
  process.env.HTTPS_PROXY = "https://preferred.example.com";
  process.env.https_proxy = "https://notused1.example.com";
  process.env.HTTP_PROXY = "http://notused2.example.com";
  process.env.http_proxy = "http://notused3.example.com";
  expect(getProxyFromEnv("https:")).toBe("https://preferred.example.com");
});

// Tests for patternMatchesHostname
test("patternMatchesHostname with exact hostname match", () => {
  expect(patternMatchesHostname("example.com", "example.com")).toBe(true);
  expect(patternMatchesHostname("example.com", "different.com")).toBe(false);
});

test("patternMatchesHostname with wildcard domains", () => {
  expect(patternMatchesHostname("sub.example.com", "*.example.com")).toBe(true);
  expect(patternMatchesHostname("sub.sub.example.com", "*.example.com")).toBe(
    true,
  );
  expect(patternMatchesHostname("example.com", "*.example.com")).toBe(false);
  expect(patternMatchesHostname("sub.different.com", "*.example.com")).toBe(
    false,
  );
});

test("patternMatchesHostname with domain suffix", () => {
  expect(patternMatchesHostname("sub.example.com", ".example.com")).toBe(true);
  expect(patternMatchesHostname("example.com", ".example.com")).toBe(true);
  expect(patternMatchesHostname("different.com", ".example.com")).toBe(false);
});

test("patternMatchesHostname with case insensitivity", () => {
  expect(patternMatchesHostname("EXAMPLE.com", "example.COM")).toBe(true);
  expect(patternMatchesHostname("sub.EXAMPLE.com", "*.example.COM")).toBe(true);
});

// Port handling tests
test("patternMatchesHostname with exact port match", () => {
  expect(patternMatchesHostname("example.com:8080", "example.com:8080")).toBe(
    true,
  );
  expect(patternMatchesHostname("example.com:8080", "example.com:9090")).toBe(
    false,
  );
});

test("patternMatchesHostname with port in pattern but not in hostname", () => {
  expect(patternMatchesHostname("example.com", "example.com:8080")).toBe(false);
});

test("patternMatchesHostname with port in hostname but not in pattern", () => {
  expect(patternMatchesHostname("example.com:8080", "example.com")).toBe(true);
});

test("patternMatchesHostname with wildcard domains and ports", () => {
  expect(
    patternMatchesHostname("sub.example.com:8080", "*.example.com:8080"),
  ).toBe(true);
  expect(
    patternMatchesHostname("sub.example.com:9090", "*.example.com:8080"),
  ).toBe(false);
  expect(patternMatchesHostname("sub.example.com", "*.example.com:8080")).toBe(
    false,
  );
});

test("patternMatchesHostname with domain suffix and ports", () => {
  expect(
    patternMatchesHostname("sub.example.com:8080", ".example.com:8080"),
  ).toBe(true);
  expect(patternMatchesHostname("example.com:8080", ".example.com:8080")).toBe(
    true,
  );
  expect(
    patternMatchesHostname("sub.example.com:9090", ".example.com:8080"),
  ).toBe(false);
});

// Tests for shouldBypassProxy
test("shouldBypassProxy returns false when NO_PROXY is not set", () => {
  expect(shouldBypassProxy("example.com", undefined)).toBe(false);
});

test("shouldBypassProxy returns true for exact hostname match", () => {
  process.env.NO_PROXY = "example.com,another.com";
  expect(shouldBypassProxy("example.com", undefined)).toBe(true);
});

test("shouldBypassProxy returns false when hostname doesn't match any NO_PROXY entry", () => {
  process.env.NO_PROXY = "example.com,another.com";
  expect(shouldBypassProxy("different.com", undefined)).toBe(false);
});

test("shouldBypassProxy handles lowercase no_proxy", () => {
  process.env.no_proxy = "example.com";
  expect(shouldBypassProxy("example.com", undefined)).toBe(true);
});

test("shouldBypassProxy works with wildcard domains", () => {
  process.env.NO_PROXY = "*.example.com";
  expect(shouldBypassProxy("sub.example.com", undefined)).toBe(true);
  expect(shouldBypassProxy("example.com", undefined)).toBe(false);
  expect(shouldBypassProxy("different.com", undefined)).toBe(false);
});

test("shouldBypassProxy works with domain suffix", () => {
  process.env.NO_PROXY = ".example.com";
  expect(shouldBypassProxy("sub.example.com", undefined)).toBe(true);
  expect(shouldBypassProxy("example.com", undefined)).toBe(true);
  expect(shouldBypassProxy("different.com", undefined)).toBe(false);
});

test("shouldBypassProxy handles multiple entries with different patterns", () => {
  process.env.NO_PROXY = "internal.local,*.example.com,.test.com";
  expect(shouldBypassProxy("internal.local", undefined)).toBe(true);
  expect(shouldBypassProxy("sub.example.com", undefined)).toBe(true);
  expect(shouldBypassProxy("sub.test.com", undefined)).toBe(true);
  expect(shouldBypassProxy("test.com", undefined)).toBe(true);
  expect(shouldBypassProxy("example.org", undefined)).toBe(false);
});

test("shouldBypassProxy ignores whitespace in NO_PROXY", () => {
  process.env.NO_PROXY = " example.com , *.test.org ";
  expect(shouldBypassProxy("example.com", undefined)).toBe(true);
  expect(shouldBypassProxy("subdomain.test.org", undefined)).toBe(true);
});

test("shouldBypassProxy with ports in NO_PROXY", () => {
  process.env.NO_PROXY = "example.com:8080,*.test.org:443,.internal.net:8443";
  expect(shouldBypassProxy("example.com:8080", undefined)).toBe(true);
  expect(shouldBypassProxy("example.com:9090", undefined)).toBe(false);
  expect(shouldBypassProxy("sub.test.org:443", undefined)).toBe(true);
  expect(shouldBypassProxy("sub.internal.net:8443", undefined)).toBe(true);
  expect(shouldBypassProxy("internal.net:8443", undefined)).toBe(true);
});

test("shouldBypassProxy accepts options with noProxy patterns", () => {
  const options = { noProxy: ["example.com:8080", "*.internal.net"] };
  expect(shouldBypassProxy("example.com:8080", options)).toBe(true);
  expect(shouldBypassProxy("example.com", options)).toBe(false);
  expect(shouldBypassProxy("server.internal.net", options)).toBe(true);
});

test("shouldBypassProxy combines environment and options noProxy patterns", () => {
  process.env.NO_PROXY = "example.org,*.test.com";
  const options = { noProxy: ["example.com:8080", "*.internal.net"] };
  expect(shouldBypassProxy("example.org", options)).toBe(true);
  expect(shouldBypassProxy("sub.test.com", options)).toBe(true);
  expect(shouldBypassProxy("example.com:8080", options)).toBe(true);
  expect(shouldBypassProxy("server.internal.net", options)).toBe(true);
  expect(shouldBypassProxy("other.domain", options)).toBe(false);
});

test("shouldBypassProxy handles empty noProxy array in options", () => {
  process.env.NO_PROXY = "example.org";
  const options = { noProxy: [] };
  expect(shouldBypassProxy("example.org", options)).toBe(true);
  expect(shouldBypassProxy("different.com", options)).toBe(false);
});

test("shouldBypassProxy handles undefined options", () => {
  process.env.NO_PROXY = "example.org";
  expect(shouldBypassProxy("example.org", undefined)).toBe(true);
});
