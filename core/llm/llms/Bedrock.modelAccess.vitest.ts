import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Bedrock from "./Bedrock.js";
import { clearBedrockCatalogCache } from "./bedrockCatalogCache.js";

const foundationModels = [
  {
    modelId: "anthropic.claude-sonnet-4-6",
    modelName: "Claude Sonnet 4.6",
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

const profiles = [
  {
    inferenceProfileId: "us.anthropic.claude-sonnet-4-6",
    status: "ACTIVE",
    type: "SYSTEM_DEFINED",
    models: [
      {
        modelArn:
          "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6",
      },
    ],
  },
  {
    // The user's own profile, over a model that is not in the catalog.
    inferenceProfileId: "my-team-claude",
    inferenceProfileName: "Team Claude",
    status: "ACTIVE",
    type: "APPLICATION",
    models: [
      {
        modelArn:
          "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-unlisted",
      },
    ],
  },
];

const formMissing = Object.assign(
  new Error(
    "You have not filled out the request form. Fill out the form before getting access.",
  ),
  { name: "ResourceNotFoundException" },
);

type UseCaseLookup = (options?: { abortSignal?: AbortSignal }) => Promise<any>;
type AvailabilityLookup = (
  modelId: string,
  options?: { abortSignal?: AbortSignal },
) => Promise<any>;

const available = async () => ({
  agreementAvailability: { status: "AVAILABLE" },
  authorizationStatus: "AUTHORIZED",
  entitlementAvailability: "AVAILABLE",
  regionAvailability: "AVAILABLE",
});

function bedrockWith(
  useCaseLookup: UseCaseLookup,
  availabilityLookup: AvailabilityLookup = available,
) {
  const order: string[] = [];
  const send = vi.fn(async (command: any, options?: any) => {
    const name = command.constructor.name;
    order.push(name);
    switch (name) {
      case "GetUseCaseForModelAccessCommand":
        return useCaseLookup(options);
      case "GetFoundationModelAvailabilityCommand":
        return availabilityLookup(command.input.modelId, options);
      case "ListFoundationModelsCommand":
        return { modelSummaries: foundationModels };
      case "ListInferenceProfilesCommand":
        return { inferenceProfileSummaries: profiles };
      default:
        throw new Error(`Unexpected command ${name}`);
    }
  });
  const llm = new Bedrock({ model: "", region: "us-east-1", apiKey: "k" });
  vi.spyOn(llm as any, "_getControlClient").mockResolvedValue({ send });
  return { llm, send, order };
}

const flagged = (models: { id: string; needsAnthropicUseCase?: boolean }[]) =>
  models.filter((m) => m.needsAnthropicUseCase).map((m) => m.id);

describe("Bedrock.listAvailableModels use-case lookup", () => {
  beforeEach(() => {
    // Every test builds the same account and region, so none may see the
    // catalog another one cached.
    clearBedrockCatalogCache({ disk: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flags only Anthropic models when the form is not filled out", async () => {
    const { llm } = bedrockWith(async () => {
      throw formMissing;
    });
    const models = await llm.listAvailableModels();
    expect(models).toHaveLength(3);
    expect(flagged(models).sort()).toEqual([
      "my-team-claude",
      "us.anthropic.claude-sonnet-4-6",
    ]);
  });

  it("flags nothing when the form has been filled out", async () => {
    const { llm } = bedrockWith(async () => ({
      formData: new Uint8Array([1]),
    }));
    const models = await llm.listAvailableModels();
    expect(models).toHaveLength(3);
    expect(flagged(models)).toEqual([]);
    expect(models.every((m) => !("needsAnthropicUseCase" in m))).toBe(true);
  });

  it.each([
    [
      "a permission refusal",
      Object.assign(new Error("not authorized"), {
        name: "AccessDeniedException",
      }),
    ],
    [
      "throttling",
      Object.assign(new Error("slow"), { name: "ThrottlingException" }),
    ],
    ["a network failure", new Error("ECONNRESET")],
    [
      "a 404 about something else",
      Object.assign(new Error("No such route"), {
        name: "ResourceNotFoundException",
      }),
    ],
  ])("leaves the listing untouched after %s", async (_label, error) => {
    const { llm } = bedrockWith(async () => {
      throw error;
    });
    const models = await llm.listAvailableModels();
    expect(models).toHaveLength(3);
    expect(flagged(models)).toEqual([]);
  });

  it("gives up on a lookup that hangs, and aborts it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const { llm } = bedrockWith((options) => {
      signal = options?.abortSignal;
      return new Promise(() => {});
    });
    const listing = llm.listAvailableModels();
    await vi.advanceTimersByTimeAsync(2000);
    const models = await listing;
    expect(models).toHaveLength(3);
    expect(flagged(models)).toEqual([]);
    expect(signal?.aborted).toBe(true);
  });

  it("does not wait for the lookup before listing", async () => {
    vi.useFakeTimers();
    const { llm, order } = bedrockWith(() => new Promise(() => {}));
    const listing = llm.listAvailableModels();
    await vi.advanceTimersByTimeAsync(0);
    expect(order.slice(0, 3)).toEqual([
      "GetUseCaseForModelAccessCommand",
      "ListFoundationModelsCommand",
      "ListInferenceProfilesCommand",
    ]);
    await vi.advanceTimersByTimeAsync(2000);
    await listing;
  });

  it("makes one lookup for the whole listing", async () => {
    const { llm, send } = bedrockWith(async () => {
      throw formMissing;
    });
    await llm.listAvailableModels();
    const lookups = send.mock.calls.filter(
      ([command]) =>
        command.constructor.name === "GetUseCaseForModelAccessCommand",
    );
    expect(lookups).toHaveLength(1);
  });

  it("still reports a listing failure", async () => {
    const { llm, send } = bedrockWith(async () => {
      throw formMissing;
    });
    send.mockImplementation(async (command: any) => {
      if (command.constructor.name === "ListFoundationModelsCommand") {
        throw new Error("listing broke");
      }
      throw formMissing;
    });
    await expect(llm.listAvailableModels()).rejects.toThrow("listing broke");
  });
});

describe("Bedrock.listAvailableModels access lookup", () => {
  beforeEach(() => {
    clearBedrockCatalogCache({ disk: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const byId = (models: { id: string; access?: string }[]) =>
    Object.fromEntries(models.map((m) => [m.id, m.access]));

  it("asks about third-party models only and stamps the profile entries", async () => {
    const asked: string[] = [];
    const { llm } = bedrockWith(available, async (modelId) => {
      asked.push(modelId);
      return {
        agreementAvailability: { status: "NOT_AVAILABLE" },
        authorizationStatus: "AUTHORIZED",
        entitlementAvailability: "AVAILABLE",
        regionAvailability: "AVAILABLE",
      };
    });
    const models = await llm.listAvailableModels();
    expect(asked).toEqual(["anthropic.claude-sonnet-4-6"]);
    expect(byId(models)).toEqual({
      "us.anthropic.claude-sonnet-4-6": "needs-access",
      "amazon.nova-pro-v1:0": undefined,
      "my-team-claude": undefined,
    });
  });

  it("reports a pending agreement", async () => {
    const { llm } = bedrockWith(available, async () => ({
      agreementAvailability: { status: "PENDING" },
    }));
    const models = await llm.listAvailableModels();
    expect(byId(models)["us.anthropic.claude-sonnet-4-6"]).toBe("pending");
  });

  it("leaves the access state out when the lookup fails", async () => {
    const { llm } = bedrockWith(available, async () => {
      throw Object.assign(new Error("not authorized"), {
        name: "AccessDeniedException",
      });
    });
    const models = await llm.listAvailableModels();
    expect(models).toHaveLength(3);
    expect(models.every((m) => !("access" in m))).toBe(true);
  });

  it("gives up on lookups that hang at the deadline, and aborts them", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const { llm } = bedrockWith(
      available,
      (_id, options) =>
        new Promise((_resolve, reject) => {
          signal = options?.abortSignal;
          // The SDK rejects an in-flight request when its signal aborts.
          signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );
    const listing = llm.listAvailableModels();
    await vi.advanceTimersByTimeAsync(10000);
    const models = await listing;
    expect(signal?.aborted).toBe(true);
    expect(models).toHaveLength(3);
    expect(models.every((m) => !("access" in m))).toBe(true);
  });
});
