import { beforeEach, describe, expect, it, vi } from "vitest";
import { IIdeMessenger } from "../../../context/IdeMessenger";
import {
  fetchProviderModels,
  initializeDynamicModels,
} from "./fetchProviderModels";
import { providers } from "./providers";

const messenger = (
  dothoosh: { status: "success"; content: any } | { status: "error" },
): IIdeMessenger =>
  ({
    request: vi.fn(async (_type: string, args: { provider: string }) =>
      args.provider === "dothoosh"
        ? dothoosh
        : { status: "success", content: [] },
    ),
  }) as unknown as IIdeMessenger;

const good = {
  status: "success" as const,
  content: [
    {
      name: "gpt-5",
      modelId: "gpt-5",
      contextLength: 400000,
      maxTokens: 128000,
    },
    { name: "kimi-k3", modelId: "kimi-k3", supportsTools: true },
  ],
};

const titles = () => providers.dothoosh?.packages.map((p) => p.title);

describe("initializeDynamicModels for DotHoosh", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    if (providers.dothoosh) providers.dothoosh.packages = [];
  });

  it("fills the picker from the live catalog with its limits", async () => {
    await initializeDynamicModels(messenger(good));

    expect(titles()).toEqual(["gpt-5", "kimi-k3"]);
    expect(providers.dothoosh?.packages[0].params).toMatchObject({
      model: "gpt-5",
      contextLength: 400000,
      completionOptions: { maxTokens: 128000 },
    });
  });

  it.each([
    ["an empty list", { status: "success" as const, content: [] }],
    ["a failed request", { status: "error" as const }],
    ["no content", { status: "success" as const, content: undefined }],
  ])("keeps the previous list after %s", async (_name, bad) => {
    await initializeDynamicModels(messenger(good));
    await initializeDynamicModels(messenger(bad as any));

    expect(titles()).toEqual(["gpt-5", "kimi-k3"]);
  });
});

describe("DotHoosh models served on the Anthropic endpoint", () => {
  const withClaude = {
    status: "success" as const,
    content: [
      { name: "kimi-k3", modelId: "kimi-k3", supportsTools: true },
      {
        name: "Claude Haiku 5.5",
        modelId: "claude-haiku-5-5",
        contextLength: 1000000,
        maxTokens: 128000,
        supportsTools: true,
        provider: "anthropic",
        apiBase: "https://gateway.dothoosh.com/anthropic/v1/",
      },
    ],
  };

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    if (providers.dothoosh) providers.dothoosh.packages = [];
  });

  it("builds a Claude package that runs on the anthropic provider with the DotHoosh base URL", async () => {
    await initializeDynamicModels(messenger(withClaude));
    const claude = providers.dothoosh?.packages.find(
      (p) => p.params.model === "claude-haiku-5-5",
    );

    expect(claude?.providerOptions).toEqual(["anthropic"]);
    expect(claude?.params).toMatchObject({
      provider: "anthropic",
      apiBase: "https://gateway.dothoosh.com/anthropic/v1/",
      contextLength: 1000000,
      completionOptions: { maxTokens: 128000 },
    });
  });

  it("keeps the Chat Completions models on the dothoosh provider", async () => {
    await initializeDynamicModels(messenger(withClaude));
    const kimi = providers.dothoosh?.packages.find(
      (p) => p.params.model === "kimi-k3",
    );

    expect(kimi?.providerOptions).toEqual(["dothoosh"]);
    expect(kimi?.params.provider).toBeUndefined();
    expect(kimi?.params.apiBase).toBeUndefined();
  });

  it("builds the same packages when the model list is fetched with a key", async () => {
    const packages = await fetchProviderModels(
      messenger(withClaude),
      "dothoosh",
      "dh-key",
    );
    const claude = packages.find((p) => p.params.model === "claude-haiku-5-5");

    expect(claude?.params).toMatchObject({
      provider: "anthropic",
      apiBase: "https://gateway.dothoosh.com/anthropic/v1/",
      contextLength: 1000000,
    });
  });
});
