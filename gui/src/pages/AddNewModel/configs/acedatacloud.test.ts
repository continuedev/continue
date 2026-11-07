import { describe, expect, it } from "vitest";
import { providers } from "./providers";

describe("Ace Data Cloud provider selection", () => {
  it("offers an explicit model and key without asking for a custom API base", () => {
    const provider = providers.acedatacloud!;
    expect(provider.title).toBe("Ace Data Cloud");
    expect(provider.provider).toBe("acedatacloud");
    expect(provider.params.apiBase).toBe("https://api.acedata.cloud/v1/");
    expect(provider.params.useResponsesApi).toBe(false);
    expect(provider.packages[0].params.model).toBe("gpt-4.1");
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
