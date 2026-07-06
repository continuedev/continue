import { describe, expect, it } from "vitest";

import { ManifestApi } from "./Manifest.js";

describe("ManifestApi", () => {
  const baseConfig = {
    provider: "manifest" as const,
  };

  it("should use default apiBase when not provided", () => {
    const api = new ManifestApi(baseConfig);
    expect(api["config"].apiBase).toBe("https://app.manifest.build/v1/");
  });

  it("should allow custom apiBase", () => {
    const api = new ManifestApi({
      ...baseConfig,
      apiBase: "http://localhost:3000/v1/",
    });
    expect(api["config"].apiBase).toBe("http://localhost:3000/v1/");
  });

  it("should include standard OpenAI headers", () => {
    const api = new ManifestApi({
      ...baseConfig,
      apiKey: "mnfst_test",
    });
    const headers = api["getHeaders"]();

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer mnfst_test");
  });
});
