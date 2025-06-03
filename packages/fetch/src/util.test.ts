import { afterEach, expect, test, vi } from "vitest";
import { getProxyFromEnv, shouldBypassProxy } from "./util.js";

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

// Tests for shouldBypassProxy
test("shouldBypassProxy returns false when NO_PROXY is not set", () => {
  expect(shouldBypassProxy("example.com")).toBe(false);
});

test("shouldBypassProxy returns true for exact hostname match", () => {
  process.env.NO_PROXY = "example.com,another.com";
  expect(shouldBypassProxy("example.com")).toBe(true);
});

test("shouldBypassProxy returns false when hostname doesn't match any NO_PROXY entry", () => {
  process.env.NO_PROXY = "example.com,another.com";
  expect(shouldBypassProxy("different.com")).toBe(false);
});

test("shouldBypassProxy handles lowercase no_proxy", () => {
  process.env.no_proxy = "example.com";
  expect(shouldBypassProxy("example.com")).toBe(true);
});

test("shouldBypassProxy works with wildcard domains", () => {
  process.env.NO_PROXY = "*.example.com";
  expect(shouldBypassProxy("sub.example.com")).toBe(true);
  expect(shouldBypassProxy("example.com")).toBe(false);
  expect(shouldBypassProxy("different.com")).toBe(false);
});

test("shouldBypassProxy works with domain suffix", () => {
  process.env.NO_PROXY = ".example.com";
  expect(shouldBypassProxy("sub.example.com")).toBe(true);
  expect(shouldBypassProxy("example.com")).toBe(true);
  expect(shouldBypassProxy("different.com")).toBe(false);
});

test("shouldBypassProxy handles multiple entries with different patterns", () => {
  process.env.NO_PROXY = "internal.local,*.example.com,.test.com";
  expect(shouldBypassProxy("internal.local")).toBe(true);
  expect(shouldBypassProxy("sub.example.com")).toBe(true);
  expect(shouldBypassProxy("sub.test.com")).toBe(true);
  expect(shouldBypassProxy("test.com")).toBe(true);
  expect(shouldBypassProxy("example.org")).toBe(false);
});

test("shouldBypassProxy ignores whitespace in NO_PROXY", () => {
  process.env.NO_PROXY = " example.com , *.test.org ";
  expect(shouldBypassProxy("example.com")).toBe(true);
  expect(shouldBypassProxy("subdomain.test.org")).toBe(true);
});
