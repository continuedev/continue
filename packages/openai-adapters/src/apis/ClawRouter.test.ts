import { describe, expect, it } from "vitest";

import { ClawRouterApi } from "./ClawRouter.js";

describe("ClawRouterApi", () => {
  const baseConfig = {
    provider: "clawrouter" as const,
  };

  it("should use default apiBase when not provided", () => {
    const api = new ClawRouterApi(baseConfig);
    expect(api["config"].apiBase).toBe("http://localhost:1337/v1/");
  });

  it("should allow custom apiBase", () => {
    const api = new ClawRouterApi({
      ...baseConfig,
      apiBase: "http://custom:8080/v1/",
    });
    expect(api["config"].apiBase).toBe("http://custom:8080/v1/");
  });

  it("should include Continue headers", () => {
    const api = new ClawRouterApi(baseConfig);
    const headers = api["getHeaders"]();

    expect(headers["User-Agent"]).toBe("Continue/IDE");
    expect(headers["X-Continue-Provider"]).toBe("clawrouter");
  });

  it("should include standard OpenAI headers", () => {
    const api = new ClawRouterApi({
      ...baseConfig,
      apiKey: "test-key",
    });
    const headers = api["getHeaders"]();

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer test-key");
  });
});
