import { describe, expect, it } from "vitest";
import { providers } from "./providers";

describe("Ace Data Cloud provider selection", () => {
  it("fetches the full catalog on selection instead of maintaining a static model list", () => {
    const provider = providers.acedatacloud!;
    expect(provider.title).toBe("Ace Data Cloud");
    expect(provider.provider).toBe("acedatacloud");
    expect(provider.params.apiBase).toBe("https://api.acedata.cloud/v1/");
    expect(provider.params.useResponsesApi).toBe(false);
    expect(provider.packages).toEqual([]);
    expect(provider.fetchModelsOnSelect).toBe(true);
    expect(
      provider.collectInputFor
        ?.filter((field) => field.required)
        .map((field) => field.key),
    ).toEqual(["apiKey"]);
    const url = new URL(provider.apiKeyUrl!);
    expect(url.pathname).toBe("/console/applications");
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
    ]) {
      expect(url.searchParams.has(key)).toBe(true);
    }
  });
});
