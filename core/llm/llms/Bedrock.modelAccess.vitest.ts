import { afterEach, describe, expect, it, vi } from "vitest";

import Bedrock from "./Bedrock.js";

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

function bedrockWith(useCaseLookup: UseCaseLookup) {
  const order: string[] = [];
  const send = vi.fn(async (command: any, options?: any) => {
    const name = command.constructor.name;
    order.push(name);
    switch (name) {
      case "GetUseCaseForModelAccessCommand":
        return useCaseLookup(options);
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
    expect(order).toEqual([
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
