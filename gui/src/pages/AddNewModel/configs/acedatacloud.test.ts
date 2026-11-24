import { describe, expect, it } from "vitest";
import { providers } from "./providers";

describe("Ace Data Cloud provider selection", () => {
  it("registers the hosted provider and a starter model in the native form", () => {
    const provider = providers.acedatacloud!;
    expect(provider.title).toBe("Ace Data Cloud");
    expect(provider.provider).toBe("acedatacloud");
    expect(provider.params.apiBase).toBe("https://api.acedata.cloud/v1/");
    expect(provider.params.useResponsesApi).toBe(false);
    expect(provider.packages.map((model) => model.params.model)).toEqual([
      "gpt-5.6-sol",
    ]);
    expect(
      provider.collectInputFor
        ?.filter((field) => field.required)
        .map((field) => field.key),
    ).toEqual(["apiKey"]);
    const url = new URL(provider.apiKeyUrl!);
    expect(url.pathname).toBe("/console/applications");
  });
});
