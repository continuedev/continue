import { describe, expect, it } from "vitest";

import {
  authorizeRequest,
  isLoopbackHost,
  serveBindingProblem,
} from "./serve.helpers.js";

describe("cn serve binding", () => {
  it("loopback addresses need no token", () => {
    for (const host of [
      "127.0.0.1",
      "localhost",
      "::1",
      "[::1]",
      "127.1.2.3",
    ]) {
      expect(isLoopbackHost(host)).toBe(true);
      expect(serveBindingProblem(host, undefined)).toBeUndefined();
    }
  });

  it("any other interface needs a token of at least 16 characters", () => {
    for (const host of ["0.0.0.0", "::", "192.168.1.20", "myhost"]) {
      expect(isLoopbackHost(host)).toBe(false);
      expect(serveBindingProblem(host, undefined)).toMatch(/--token/);
      expect(serveBindingProblem(host, "short")).toMatch(/16 characters/);
      expect(serveBindingProblem(host, "0123456789abcdef0123")).toBeUndefined();
    }
  });
});

describe("the bearer token", () => {
  const token = "0123456789abcdef0123";

  it("accepts the exact token", () => {
    expect(authorizeRequest(`Bearer ${token}`, token)).toBe(true);
    expect(authorizeRequest(`bearer ${token}`, token)).toBe(true);
  });

  it("rejects a missing, different or partial token", () => {
    expect(authorizeRequest(undefined, token)).toBe(false);
    expect(authorizeRequest("", token)).toBe(false);
    expect(authorizeRequest(token, token)).toBe(false);
    expect(authorizeRequest(`Bearer ${token}x`, token)).toBe(false);
    expect(authorizeRequest(`Bearer ${token.slice(0, -1)}`, token)).toBe(false);
    expect(authorizeRequest("Basic abc", token)).toBe(false);
  });
});
