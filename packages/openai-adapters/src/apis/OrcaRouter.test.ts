import { describe, expect, it } from "vitest";

import { OrcaRouterApi } from "./OrcaRouter.js";

describe("OrcaRouterApi", () => {
  const baseConfig = {
    provider: "orcarouter" as const,
  };

  it("should use default apiBase when not provided", () => {
    const api = new OrcaRouterApi(baseConfig);
    expect(api["config"].apiBase).toBe("https://api.orcarouter.ai/v1/");
  });

  it("should allow custom apiBase", () => {
    const api = new OrcaRouterApi({
      ...baseConfig,
      apiBase: "https://api.custom-orca.example.com/v1/",
    });
    expect(api["config"].apiBase).toBe(
      "https://api.custom-orca.example.com/v1/",
    );
  });

  it("should include Continue attribution headers", () => {
    const api = new OrcaRouterApi(baseConfig);
    const headers = api["getHeaders"]();

    expect(headers["HTTP-Referer"]).toBe("https://www.continue.dev/");
    expect(headers["X-Title"]).toBe("Continue");
    expect(headers["User-Agent"]).toBe("Continue/IDE");
    expect(headers["X-Continue-Provider"]).toBe("orcarouter");
  });

  it("should include standard OpenAI headers", () => {
    const api = new OrcaRouterApi({
      ...baseConfig,
      apiKey: "sk-orca-test",
    });
    const headers = api["getHeaders"]();

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer sk-orca-test");
  });
});
