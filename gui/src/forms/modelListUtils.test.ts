import { describe, expect, it } from "vitest";
import type { ModelPackage } from "../pages/AddNewModel/configs/models";
import {
  bedrockEndpointModelsToPackages,
  bedrockOptionsToPackages,
  computeModelLists,
  crossEndpointKey,
  isLikelyChatModelId,
  mergeBedrockEndpoints,
  mergeLiveModels,
  splitPopular,
} from "./modelListUtils";

const pkg = (
  model: string,
  extra: Partial<ModelPackage> = {},
): ModelPackage => ({
  title: extra.title ?? model,
  description: "",
  params: { model },
  isOpenSource: false,
  ...extra,
});

describe("isLikelyChatModelId", () => {
  it("drops embedding, audio and image models", () => {
    for (const id of [
      "text-embedding-3-large",
      "whisper-1",
      "gpt-4o-realtime-preview",
      "dall-e-3",
      "omni-moderation-latest",
      "gpt-image-1",
    ]) {
      expect(isLikelyChatModelId(id)).toBe(false);
    }
    expect(isLikelyChatModelId("gpt-6-astra")).toBe(true);
    expect(isLikelyChatModelId("claude-opus-5-5")).toBe(true);
  });
});

describe("bedrockOptionsToPackages", () => {
  it("keeps one entry when a model is on demand and via a profile", () => {
    const out = bedrockOptionsToPackages([
      {
        id: "anthropic.claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        provider: "Anthropic",
        kind: "on-demand",
        baseModelId: "anthropic.claude-sonnet-5-5",
      },
      {
        id: "us.anthropic.claude-sonnet-5-5",
        name: "Claude Sonnet 5.5 (us. cross-region)",
        provider: "Anthropic",
        kind: "inference-profile",
        baseModelId: "anthropic.claude-sonnet-5-5",
      },
      {
        id: "us.anthropic.claude-haiku-5-5",
        name: "Claude Haiku 5.5 (us. cross-region)",
        provider: "Anthropic",
        kind: "inference-profile",
        baseModelId: "anthropic.claude-haiku-5-5",
      },
    ]);
    expect(out.map((p) => p.params.model)).toEqual([
      "anthropic.claude-sonnet-5-5",
      "us.anthropic.claude-haiku-5-5",
    ]);
    expect(out[0].params.title).toBe("Claude Sonnet 5.5 (Bedrock)");
    expect(out[0].icon).toBe("anthropic.png");
  });

  it("flags legacy models as deprecated", () => {
    const [p] = bedrockOptionsToPackages([
      {
        id: "anthropic.claude-3-sonnet-20240229-v1:0",
        name: "Claude 3 Sonnet",
        provider: "Anthropic",
        kind: "on-demand",
        legacy: true,
      },
    ]);
    expect(p.deprecated).toBe(true);
  });
});

describe("mergeLiveModels", () => {
  it("keeps curated details, adds the live date, and drops unavailable models", () => {
    const curated = [
      pkg("claude-opus-5-5", { title: "Claude Opus 5.5", description: "good" }),
      pkg("claude-old", { title: "Old" }),
    ];
    const live = [
      pkg("claude-opus-5-5", { createdAt: "2026-09-21T00:00:00Z" }),
      pkg("claude-new", { title: "New" }),
    ];
    const merged = mergeLiveModels(curated, live);
    expect(merged.map((m) => m.params.model)).toEqual([
      "claude-opus-5-5",
      "claude-new",
    ]);
    expect(merged[0].title).toBe("Claude Opus 5.5");
    expect(merged[0].description).toBe("good");
    expect(merged[0].createdAt).toBe("2026-09-21T00:00:00Z");
  });
});

describe("splitPopular", () => {
  it("promotes the newest active models and never promotes deprecated ones", () => {
    const models = [
      pkg("a", { createdAt: "2026-01-01T00:00:00Z" }),
      pkg("b", { createdAt: "2026-03-01T00:00:00Z" }),
      pkg("c", { createdAt: "2026-05-01T00:00:00Z", deprecated: true }),
      pkg("d", { createdAt: "2026-02-01T00:00:00Z" }),
    ];
    const { top, other } = splitPopular(models, [], 2);
    expect(top.map((m) => m.params.model)).toEqual(["b", "d"]);
    expect(other.map((m) => m.params.model)).toEqual(["a", "c"]);
  });

  it("uses curated order when there are no dates, then the title", () => {
    const curated = [pkg("x"), pkg("y")];
    const { top } = splitPopular(
      [pkg("z", { title: "Z" }), pkg("y"), pkg("x")],
      curated,
      3,
    );
    expect(top.map((m) => m.params.model)).toEqual(["x", "y", "z"]);
  });

  it("removes duplicates, including geography-prefixed Bedrock ids", () => {
    const { top } = splitPopular(
      [
        pkg("anthropic.claude-x", { title: "X" }),
        pkg("us.anthropic.claude-x", { title: "X (us)" }),
      ],
      [],
    );
    expect(top).toHaveLength(1);
  });
});

describe("computeModelLists", () => {
  const provider = {
    packages: [pkg("one"), pkg("two")],
    popularPackages: [pkg("one")],
  };

  it("shows the curated lists until a live list is loaded", () => {
    const lists = computeModelLists(provider, []);
    expect(lists.isLive).toBe(false);
    expect(lists.top.map((m) => m.params.model)).toEqual(["one"]);
    expect(lists.other?.map((m) => m.params.model)).toEqual(["two"]);
  });

  it("replaces them with the live list once it is loaded", () => {
    const lists = computeModelLists(provider, [pkg("two"), pkg("three")]);
    expect(lists.isLive).toBe(true);
    const all = [...lists.top, ...(lists.other ?? [])].map(
      (m) => m.params.model,
    );
    expect(all.sort()).toEqual(["three", "two"]);
  });
});

describe("crossEndpointKey", () => {
  it("ignores geography prefixes, version and snapshot suffixes", () => {
    expect(crossEndpointKey("us.anthropic.claude-sonnet-4-6")).toBe(
      "anthropic.claude-sonnet-4-6",
    );
    expect(crossEndpointKey("anthropic.claude-sonnet-4-5-20250929-v1:0")).toBe(
      "anthropic.claude-sonnet-4-5",
    );
    expect(crossEndpointKey("anthropic.claude-sonnet-4-5")).toBe(
      "anthropic.claude-sonnet-4-5",
    );
    expect(crossEndpointKey("OpenAI.GPT-OSS-120B")).toBe("openai.gpt-oss-120b");
  });
});

describe("mergeBedrockEndpoints", () => {
  const opt = (id: string, name = id) => ({
    id,
    name,
    provider: "X",
    kind: "on-demand" as const,
  });

  it("lists a model on both endpoints once, as a standard-endpoint entry", () => {
    const merged = mergeBedrockEndpoints(
      [opt("openai.gpt-oss-120b")],
      [opt("openai.gpt-oss-120b")],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      endpoint: "runtime",
      alsoOnMantle: true,
    });
  });

  it("keeps Mantle-only models and tags them", () => {
    const merged = mergeBedrockEndpoints(
      [opt("anthropic.claude-sonnet-5-5")],
      [opt("openai.gpt-daybreak-blue-5.6-sol")],
    );
    expect(merged.map((m) => `${m.endpoint}:${m.id}`)).toEqual([
      "runtime:anthropic.claude-sonnet-5-5",
      "mantle:openai.gpt-daybreak-blue-5.6-sol",
    ]);
    expect(merged[0].alsoOnMantle).toBeUndefined();
  });

  it("matches a profile-only standard model to its Mantle twin", () => {
    const merged = mergeBedrockEndpoints(
      [
        {
          id: "us.anthropic.claude-opus-4-7",
          name: "Claude Opus 4.7 (us.)",
          provider: "Anthropic",
          kind: "inference-profile" as const,
          baseModelId: "anthropic.claude-opus-4-7",
        },
      ],
      [opt("anthropic.claude-opus-4-7")],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].endpoint).toBe("runtime");
  });

  it("works with only one endpoint", () => {
    expect(mergeBedrockEndpoints([], [opt("a.b")])[0].endpoint).toBe("mantle");
    expect(mergeBedrockEndpoints([opt("a.b")], [])[0].endpoint).toBe("runtime");
    expect(mergeBedrockEndpoints([], [])).toEqual([]);
  });
});

describe("bedrockEndpointModelsToPackages", () => {
  it("routes each model to its own provider and labels Mantle-only ones", () => {
    const pkgs = bedrockEndpointModelsToPackages([
      {
        id: "anthropic.claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        provider: "Anthropic",
        kind: "on-demand",
        endpoint: "runtime",
      },
      {
        id: "openai.gpt-daybreak-blue-5.6-sol",
        name: "GPT Daybreak Blue 5.6 Sol",
        provider: "OpenAI",
        kind: "on-demand",
        endpoint: "mantle",
      },
    ]);
    expect(pkgs.map((p) => p.endpointProvider)).toEqual([
      "bedrock",
      "bedrock-mantle",
    ]);
    expect(pkgs[0].title).toBe("Claude Sonnet 5.5");
    expect(pkgs[1].title).toBe("GPT Daybreak Blue 5.6 Sol · Mantle");
    expect(pkgs[1].params.title).toBe(
      "GPT Daybreak Blue 5.6 Sol (Bedrock Mantle)",
    );
  });

  it("does not add the Mantle label on the dedicated Mantle form", () => {
    const [p] = bedrockOptionsToPackages(
      [{ id: "a.b", name: "B", provider: "A", kind: "on-demand" }],
      "bedrock-mantle",
    );
    expect(p.title).toBe("B");
  });
});
