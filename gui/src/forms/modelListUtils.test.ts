import { describe, expect, it } from "vitest";
import type { ModelPackage } from "../pages/AddNewModel/configs/models";
import {
  bedrockOptionsToPackages,
  computeModelLists,
  isLikelyChatModelId,
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
