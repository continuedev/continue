import { describe, expect, it } from "@jest/globals";
import type { RequestOptions } from "../schemas/models.js";
import { mergeConfigYamlRequestOptions } from "./merge.js";

describe("mergeConfigYamlRequestOptions", () => {
  it("should return undefined when both base and global are undefined", () => {
    const result = mergeConfigYamlRequestOptions(undefined, undefined);
    expect(result).toBeUndefined();
  });

  it("should return global when base is undefined", () => {
    const global: RequestOptions = {
      timeout: 5000,
      verifySsl: true,
      headers: { Authorization: "Bearer token" },
    };
    const result = mergeConfigYamlRequestOptions(undefined, global);
    expect(result).toEqual(global);
  });

  it("should return base when global is undefined", () => {
    const base: RequestOptions = {
      timeout: 3000,
      verifySsl: false,
      headers: { "X-Custom": "value" },
    };
    const result = mergeConfigYamlRequestOptions(base, undefined);
    expect(result).toEqual(base);
  });

  it("should merge headers from both objects", () => {
    const base: RequestOptions = {
      headers: { "X-Base": "base-value", "X-Common": "base-common" },
    };
    const global: RequestOptions = {
      headers: { "X-Global": "global-value", "X-Common": "global-common" },
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result?.headers).toEqual({
      "X-Global": "global-value",
      "X-Common": "base-common", // base overrides global
      "X-Base": "base-value",
    });
  });

  it("should override simple values with base values", () => {
    const base: RequestOptions = {
      timeout: 3000,
      verifySsl: false,
      proxy: "http://base-proxy.com",
    };
    const global: RequestOptions = {
      timeout: 5000,
      verifySsl: true,
      proxy: "http://global-proxy.com",
      caBundlePath: "/path/to/ca",
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result).toEqual({
      timeout: 3000, // base overrides
      verifySsl: false, // base overrides
      proxy: "http://base-proxy.com", // base overrides
      caBundlePath: "/path/to/ca", // only in global
      headers: undefined,
    });
  });

  it("should handle noProxy array properly (base overrides)", () => {
    const base: RequestOptions = {
      noProxy: ["localhost", "127.0.0.1"],
    };
    const global: RequestOptions = {
      noProxy: ["192.168.1.1", "example.com"],
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result?.noProxy).toEqual(["localhost", "127.0.0.1"]); // base overrides completely
  });

  it("should handle extraBodyProperties (base overrides)", () => {
    const base: RequestOptions = {
      extraBodyProperties: { baseProp: "baseValue", common: "base" },
    };
    const global: RequestOptions = {
      extraBodyProperties: { globalProp: "globalValue", common: "global" },
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result?.extraBodyProperties).toEqual({
      baseProp: "baseValue",
      common: "base",
    }); // base overrides completely
  });

  it("should handle clientCertificate (base overrides)", () => {
    const base: RequestOptions = {
      clientCertificate: {
        cert: "base-cert",
        key: "base-key",
        passphrase: "base-pass",
      },
    };
    const global: RequestOptions = {
      clientCertificate: {
        cert: "global-cert",
        key: "global-key",
      },
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result?.clientCertificate).toEqual({
      cert: "base-cert",
      key: "base-key",
      passphrase: "base-pass",
    }); // base overrides completely
  });

  it("should return undefined headers when both have empty headers", () => {
    const base: RequestOptions = {
      headers: {},
      timeout: 1000,
    };
    const global: RequestOptions = {
      headers: {},
      verifySsl: true,
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result?.headers).toBeUndefined();
    expect(result?.timeout).toBe(1000);
    expect(result?.verifySsl).toBe(true);
  });

  it("should handle caBundlePath as string", () => {
    const base: RequestOptions = {
      caBundlePath: "/base/ca.pem",
    };
    const global: RequestOptions = {
      caBundlePath: "/global/ca.pem",
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result?.caBundlePath).toBe("/base/ca.pem"); // base overrides
  });

  it("should handle caBundlePath as array", () => {
    const base: RequestOptions = {
      caBundlePath: ["/base/ca1.pem", "/base/ca2.pem"],
    };
    const global: RequestOptions = {
      caBundlePath: ["/global/ca.pem"],
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result?.caBundlePath).toEqual(["/base/ca1.pem", "/base/ca2.pem"]); // base overrides
  });

  it("should preserve all fields from base when global has different fields", () => {
    const base: RequestOptions = {
      timeout: 3000,
      headers: { "X-Base": "value" },
      noProxy: ["localhost"],
    };
    const global: RequestOptions = {
      verifySsl: true,
      proxy: "http://proxy.com",
      caBundlePath: "/ca.pem",
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result).toEqual({
      timeout: 3000,
      verifySsl: true,
      proxy: "http://proxy.com",
      caBundlePath: "/ca.pem",
      headers: { "X-Base": "value" },
      noProxy: ["localhost"],
    });
  });

  it("should handle complex header merging scenario", () => {
    const base: RequestOptions = {
      headers: {
        Authorization: "Bearer base-token",
        "X-Custom-Header": "base-custom",
        "Content-Type": "application/json",
      },
    };
    const global: RequestOptions = {
      headers: {
        Authorization: "Bearer global-token",
        "X-Global-Header": "global-value",
        "Accept-Language": "en-US",
      },
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result?.headers).toEqual({
      Authorization: "Bearer base-token", // base overrides
      "X-Global-Header": "global-value", // from global
      "Accept-Language": "en-US", // from global
      "X-Custom-Header": "base-custom", // from base
      "Content-Type": "application/json", // from base
    });
  });

  it("should handle all possible fields", () => {
    const base: RequestOptions = {
      timeout: 1000,
      verifySsl: false,
      caBundlePath: ["/base/ca.pem"],
      proxy: "http://base-proxy.com",
      headers: { "X-Base": "base" },
      extraBodyProperties: { baseProp: true },
      noProxy: ["base.local"],
      clientCertificate: { cert: "base-cert", key: "base-key" },
    };
    const global: RequestOptions = {
      timeout: 2000,
      verifySsl: true,
      caBundlePath: ["/global/ca.pem"],
      proxy: "http://global-proxy.com",
      headers: { "X-Global": "global" },
      extraBodyProperties: { globalProp: false },
      noProxy: ["global.local"],
      clientCertificate: { cert: "global-cert", key: "global-key" },
    };
    const result = mergeConfigYamlRequestOptions(base, global);
    expect(result).toEqual({
      timeout: 1000, // base overrides
      verifySsl: false, // base overrides
      caBundlePath: ["/base/ca.pem"], // base overrides
      proxy: "http://base-proxy.com", // base overrides
      headers: {
        "X-Global": "global",
        "X-Base": "base",
      }, // merged
      extraBodyProperties: { baseProp: true }, // base overrides
      noProxy: ["base.local"], // base overrides
      clientCertificate: { cert: "base-cert", key: "base-key" }, // base overrides
    });
  });
});
