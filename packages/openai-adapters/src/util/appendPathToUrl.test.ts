import { describe, expect, it } from "vitest";

import { appendPathToUrlIfNotPresent } from "./appendPathToUrl.js";

describe("appendPathToUrlIfNotPresent", () => {
  it("should append path to URL with trailing slash", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com/",
      "v1/chat",
    );

    expect(result).toBe("https://api.example.com/v1/chat/");
  });

  it("should append path to URL without trailing slash", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com",
      "v1/chat",
    );

    expect(result).toBe("https://api.example.com/v1/chat/");
  });

  it("should not duplicate path if already present", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com/v1/chat/",
      "v1/chat",
    );

    expect(result).toBe("https://api.example.com/v1/chat/");
  });

  it("should not duplicate path if present without trailing slash", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com/v1/chat",
      "v1/chat",
    );

    expect(result).toBe("https://api.example.com/v1/chat/");
  });

  it("should handle URL with existing path and append new path", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com/api",
      "v1",
    );

    expect(result).toBe("https://api.example.com/api/v1/");
  });

  it("should preserve query parameters", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com/?key=value",
      "v1/chat",
    );

    expect(result).toBe("https://api.example.com/v1/chat/?key=value");
  });

  it("should preserve multiple query parameters", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com/?key1=value1&key2=value2",
      "v1",
    );

    expect(result).toBe("https://api.example.com/v1/?key1=value1&key2=value2");
  });

  it("should handle URL with port number", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com:8080/",
      "v1/chat",
    );

    expect(result).toBe("https://api.example.com:8080/v1/chat/");
  });

  it("should handle localhost URLs", () => {
    const result = appendPathToUrlIfNotPresent(
      "http://localhost:3000/",
      "api/v1",
    );

    expect(result).toBe("http://localhost:3000/api/v1/");
  });

  it("should handle simple path without slashes", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com/",
      "endpoint",
    );

    expect(result).toBe("https://api.example.com/endpoint/");
  });

  it("should handle deeply nested existing paths", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://api.example.com/a/b/c/",
      "d/e",
    );

    expect(result).toBe("https://api.example.com/a/b/c/d/e/");
  });

  it("should handle URL with username and password", () => {
    const result = appendPathToUrlIfNotPresent(
      "https://user:pass@api.example.com/",
      "v1",
    );

    expect(result).toBe("https://user:pass@api.example.com/v1/");
  });
});
