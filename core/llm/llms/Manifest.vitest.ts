import { describe, expect, it } from "vitest";

import Manifest from "./Manifest";

describe("Manifest", () => {
  it("should have correct provider name", () => {
    expect(Manifest.providerName).toBe("manifest");
  });

  it("should have correct default options", () => {
    expect(Manifest.defaultOptions?.apiBase).toBe(
      "https://app.manifest.build/v1/",
    );
    expect(Manifest.defaultOptions?.model).toBe("auto");
    expect(Manifest.defaultOptions?.useLegacyCompletionsEndpoint).toBe(false);
  });

  it("should default to the auto model", () => {
    const manifest = new Manifest({
      model: "auto",
      apiKey: "mnfst_test",
    });

    expect(manifest.model).toBe("auto");
  });

  it("should allow overriding the apiBase", () => {
    const manifest = new Manifest({
      model: "auto",
      apiKey: "mnfst_test",
      apiBase: "http://localhost:3000/v1/",
    });

    expect(manifest.apiBase).toBe("http://localhost:3000/v1/");
  });
});
