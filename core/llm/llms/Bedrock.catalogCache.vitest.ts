import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Bedrock from "./Bedrock.js";
import {
  BEDROCK_CATALOG_TTL_MS,
  bedrockCatalogCacheKey,
  clearBedrockCatalogCache,
  readBedrockCatalogCache,
  writeBedrockCatalogCache,
} from "./bedrockCatalogCache.js";

const foundationModels = [
  {
    modelId: "anthropic.claude-haiku-4-5",
    modelName: "Claude Haiku 4.5",
    providerName: "Anthropic",
    outputModalities: ["TEXT"],
    inferenceTypesSupported: ["INFERENCE_PROFILE"],
  },
  {
    modelId: "amazon.nova-pro-v1:0",
    modelName: "Nova Pro",
    providerName: "Amazon",
    outputModalities: ["TEXT"],
    inferenceTypesSupported: ["ON_DEMAND"],
  },
];

const profile = (id: string) => ({
  inferenceProfileId: id,
  status: "ACTIVE",
  type: "SYSTEM_DEFINED",
  models: [
    {
      modelArn:
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5",
    },
  ],
});

const profiles = [
  profile("us.anthropic.claude-haiku-4-5"),
  profile("global.anthropic.claude-haiku-4-5"),
];

/** A fake control-plane client; `send` counts the calls per command. */
function fakeClient() {
  const send = vi.fn(async (command: any) => {
    switch (command.constructor.name) {
      case "GetUseCaseForModelAccessCommand":
        return { formData: new Uint8Array([1]) };
      case "GetFoundationModelAvailabilityCommand":
        return { agreementAvailability: { status: "AVAILABLE" } };
      case "ListFoundationModelsCommand":
        return { modelSummaries: foundationModels };
      case "ListInferenceProfilesCommand":
        return { inferenceProfileSummaries: profiles };
      default:
        throw new Error(`Unexpected command ${command.constructor.name}`);
    }
  });
  return send;
}

function bedrock(options: Record<string, unknown> = {}) {
  const llm = new Bedrock({
    model: "",
    region: "us-east-1",
    apiKey: "k",
    ...options,
  });
  const send = fakeClient();
  vi.spyOn(llm as any, "_getControlClient").mockResolvedValue({ send });
  return { llm, send };
}

const listings = (send: ReturnType<typeof fakeClient>) =>
  send.mock.calls.filter(
    ([command]) => command.constructor.name === "ListFoundationModelsCommand",
  ).length;

describe("bedrockCatalogCacheKey", () => {
  it("hashes secrets, names profiles, and includes the region", () => {
    const key = bedrockCatalogCacheKey(
      { apiKey: "bedrock-api-key-abc" },
      "us-east-1",
    );
    expect(key).not.toContain("abc");
    expect(key).toMatch(/^key:[0-9a-f]{24}@us-east-1$/);
    expect(
      bedrockCatalogCacheKey({ accessKeyId: "AKIAEXAMPLE" }, "eu-west-1"),
    ).toMatch(/^akid:[0-9a-f]{24}@eu-west-1$/);
    expect(bedrockCatalogCacheKey({ profile: "work" }, "us-east-1")).toBe(
      "profile:work@us-east-1",
    );
    expect(bedrockCatalogCacheKey({}, "us-east-1")).toBe(
      "default-chain@us-east-1",
    );
  });

  it("differs per account and per region", () => {
    const a = bedrockCatalogCacheKey({ apiKey: "one" }, "us-east-1");
    expect(bedrockCatalogCacheKey({ apiKey: "two" }, "us-east-1")).not.toBe(a);
    expect(bedrockCatalogCacheKey({ apiKey: "one" }, "us-west-2")).not.toBe(a);
  });
});

describe("Bedrock catalog cache", () => {
  beforeEach(() => {
    clearBedrockCatalogCache({ disk: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    clearBedrockCatalogCache({ disk: true });
  });

  it("lists once per account and region within an hour", async () => {
    const first = bedrock();
    const models = await first.llm.listAvailableModels();
    expect(models.map((m) => m.id).sort()).toEqual([
      "amazon.nova-pro-v1:0",
      "global.anthropic.claude-haiku-4-5",
      "us.anthropic.claude-haiku-4-5",
    ]);

    // A second instance with the same key and region: no call at all.
    const second = bedrock();
    expect(await second.llm.listAvailableModels()).toEqual(models);
    expect(second.send).not.toHaveBeenCalled();

    // Another region is another catalog.
    const elsewhere = bedrock({ region: "eu-west-1" });
    await elsewhere.llm.listAvailableModels();
    expect(listings(elsewhere.send)).toBe(1);

    // Another account too.
    const other = bedrock({ apiKey: "other" });
    await other.llm.listAvailableModels();
    expect(listings(other.send)).toBe(1);
  });

  it("lists again on refresh and when the entry is older than an hour", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T10:00:00Z"));
    const { llm, send } = bedrock();
    await llm.listAvailableModels();
    await llm.listAvailableModels({ refresh: true });
    expect(listings(send)).toBe(2);

    vi.setSystemTime(new Date("2026-11-08T10:59:00Z"));
    await llm.listAvailableModels();
    expect(listings(send)).toBe(2);

    vi.setSystemTime(new Date("2026-11-08T11:00:01Z"));
    await llm.listAvailableModels();
    expect(listings(send)).toBe(3);
  });

  it("survives a restart through the disk copy", async () => {
    const { llm, send } = bedrock();
    const models = await llm.listAvailableModels();
    clearBedrockCatalogCache(); // memory only, as a new process would start
    expect(await llm.listAvailableModels()).toEqual(models);
    expect(listings(send)).toBe(1);
  });

  it("ignores a disk entry written for another key or too long ago", () => {
    const key = bedrockCatalogCacheKey({ apiKey: "k" }, "us-east-1");
    const now = Date.parse("2026-11-08T10:00:00Z");
    writeBedrockCatalogCache(key, [], now - BEDROCK_CATALOG_TTL_MS - 1);
    clearBedrockCatalogCache();
    expect(readBedrockCatalogCache(key, now)).toBeUndefined();
    writeBedrockCatalogCache(key, [], now);
    clearBedrockCatalogCache();
    expect(readBedrockCatalogCache(key, now)).toEqual([]);
    expect(
      readBedrockCatalogCache(
        bedrockCatalogCacheKey({ apiKey: "k" }, "us-west-2"),
        now,
      ),
    ).toBeUndefined();
  });

  it("does not list when a listing failed and nothing is cached", async () => {
    const { llm, send } = bedrock();
    send.mockImplementation(async () => {
      throw new Error("listing broke");
    });
    await expect(llm.listAvailableModels()).rejects.toThrow("listing broke");
    expect(llm.cachedCatalog()).toBeUndefined();
  });
});

describe("Bedrock.inferenceProfileWarning", () => {
  beforeEach(() => {
    clearBedrockCatalogCache({ disk: true });
  });
  afterEach(() => {
    clearBedrockCatalogCache({ disk: true });
  });

  it("says nothing before the account's catalog has been listed", () => {
    const { llm } = bedrock({ model: "anthropic.claude-haiku-4-5" });
    expect(llm.inferenceProfileWarning()).toBeUndefined();
  });

  it("names the profile IDs for a bare ID that needs one, from the cache", async () => {
    await bedrock().llm.listAvailableModels();
    const { llm, send } = bedrock({ model: "anthropic.claude-haiku-4-5" });
    const warning = llm.inferenceProfileWarning()!;
    expect(warning).toContain("`us.anthropic.claude-haiku-4-5`");
    expect(warning).toContain("`global.anthropic.claude-haiku-4-5`");
    expect(warning).toContain("crossRegionInference: auto");
    expect(send).not.toHaveBeenCalled();
  });

  it("is quiet for on-demand IDs, prefixed IDs and when crossRegionInference is set", async () => {
    await bedrock().llm.listAvailableModels();
    expect(
      bedrock({ model: "amazon.nova-pro-v1:0" }).llm.inferenceProfileWarning(),
    ).toBeUndefined();
    expect(
      bedrock({
        model: "us.anthropic.claude-haiku-4-5",
      }).llm.inferenceProfileWarning(),
    ).toBeUndefined();
    expect(
      bedrock({
        model: "anthropic.claude-haiku-4-5",
        crossRegionInference: "auto",
      }).llm.inferenceProfileWarning(),
    ).toBeUndefined();
  });
});
