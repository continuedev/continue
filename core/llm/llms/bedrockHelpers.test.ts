import {
  applyCrossRegionInference,
  bedrockCacheTtl,
  bedrockSupportsOneHourCache,
  bedrockUsageToUsage,
  buildModelCatalog,
  getBedrockErrorHint,
  globalProfileStatus,
  inferenceProfilePrefixForRegion,
} from "./bedrockHelpers";

describe("inferenceProfilePrefixForRegion", () => {
  it.each([
    ["us-east-1", "us"],
    ["us-west-2", "us"],
    ["us-gov-west-1", "us-gov"],
    ["eu-central-1", "eu"],
    ["ap-southeast-2", "apac"],
    ["sa-east-1", undefined],
    [undefined, undefined],
  ])("%s -> %s", (region, expected) => {
    expect(inferenceProfilePrefixForRegion(region)).toBe(expected);
  });
});

describe("applyCrossRegionInference", () => {
  const model = "anthropic.claude-sonnet-4-20250514-v1:0";

  it("is a no-op when unset", () => {
    expect(applyCrossRegionInference(model, undefined, "us-east-1")).toBe(
      model,
    );
  });

  it("derives the prefix from the region with 'auto'", () => {
    expect(applyCrossRegionInference(model, "auto", "eu-west-1")).toBe(
      `eu.${model}`,
    );
  });

  it("uses an explicit prefix, including global", () => {
    expect(applyCrossRegionInference(model, "global", "us-east-1")).toBe(
      `global.${model}`,
    );
  });

  it("leaves 'auto' alone for regions without a known prefix", () => {
    expect(applyCrossRegionInference(model, "auto", "sa-east-1")).toBe(model);
  });

  it("does not double-prefix existing profile IDs", () => {
    expect(applyCrossRegionInference(`us.${model}`, "eu", "eu-west-1")).toBe(
      `us.${model}`,
    );
  });

  it("leaves ARNs untouched", () => {
    const arn =
      "arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude";
    expect(applyCrossRegionInference(arn, "auto", "us-east-1")).toBe(arn);
  });
});

describe("getBedrockErrorHint", () => {
  it("suggests aws sso login with the profile for SSO expiry", () => {
    const hint = getBedrockErrorHint(
      new Error("The SSO session associated with this profile has expired"),
      { profile: "work" },
    );
    expect(hint).toContain("aws sso login --profile work");
  });

  it("explains how to configure credentials when none are found", () => {
    const e = Object.assign(
      new Error("Could not load credentials from any providers"),
      {
        name: "CredentialsProviderError",
      },
    );
    expect(getBedrockErrorHint(e, {})).toContain("AWS_BEARER_TOKEN_BEDROCK");
  });

  it("points at crossRegionInference for on-demand throughput errors", () => {
    const e = Object.assign(
      new Error(
        "Invocation of model ID anthropic.claude with on-demand throughput isn't supported. Retry with an inference profile",
      ),
      { name: "ValidationException" },
    );
    expect(getBedrockErrorHint(e, {})).toContain("crossRegionInference");
  });

  it("points at model access for AccessDenied on a model", () => {
    const e = Object.assign(
      new Error(
        "You don't have access to the model with the specified model ID.",
      ),
      { name: "AccessDeniedException" },
    );
    expect(getBedrockErrorHint(e, { region: "us-west-2" })).toContain(
      "us-west-2",
    );
  });

  it("does not blame model access when a policy explicitly denies it", () => {
    const e = Object.assign(
      new Error(
        "User: arn:aws:sts::1:assumed-role/dev is not authorized to perform: bedrock:InvokeModel on resource: arn:aws:bedrock:us-east-1:1:inference-profile/us.openai.example with an explicit deny in a service control policy",
      ),
      { name: "AccessDeniedException" },
    );
    const hint = getBedrockErrorHint(e, { region: "us-east-1" })!;
    expect(hint).toContain("explicitly denied");
    expect(hint).toContain("administrator");
    expect(hint).not.toContain("make sure the model is enabled");
  });

  it("returns undefined for unrelated errors", () => {
    expect(getBedrockErrorHint(new Error("boom"), {})).toBeUndefined();
  });
});

describe("buildModelCatalog", () => {
  const fms = [
    {
      modelId: "anthropic.claude-sonnet-4-6",
      modelName: "Claude Sonnet 4.6",
      providerName: "Anthropic",
      outputModalities: ["TEXT"],
      responseStreamingSupported: true,
      inferenceTypesSupported: ["INFERENCE_PROFILE"],
    },
    {
      modelId: "amazon.nova-pro-v1:0",
      modelName: "Nova Pro",
      providerName: "Amazon",
      outputModalities: ["TEXT"],
      responseStreamingSupported: true,
      inferenceTypesSupported: ["ON_DEMAND", "INFERENCE_PROFILE"],
    },
    {
      modelId: "amazon.titan-embed-text-v2:0",
      modelName: "Titan Embeddings",
      providerName: "Amazon",
      outputModalities: ["EMBEDDING"],
      inferenceTypesSupported: ["ON_DEMAND"],
    },
    {
      modelId: "old.model-v1",
      modelName: "Old Model",
      providerName: "Zed",
      outputModalities: ["TEXT"],
      responseStreamingSupported: false,
      inferenceTypesSupported: ["ON_DEMAND"],
    },
  ];
  const profiles = [
    {
      inferenceProfileId: "us.anthropic.claude-sonnet-4-6",
      type: "SYSTEM_DEFINED",
      status: "ACTIVE",
      models: [
        {
          modelArn:
            "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6",
        },
      ],
    },
    {
      inferenceProfileId: "us.amazon.nova-pro-v1:0",
      type: "SYSTEM_DEFINED",
      status: "ACTIVE",
      models: [
        {
          modelArn:
            "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
        },
      ],
    },
    {
      inferenceProfileId: "us.embed.titan",
      type: "SYSTEM_DEFINED",
      status: "ACTIVE",
      models: [
        {
          modelArn:
            "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
        },
      ],
    },
    {
      inferenceProfileId: "abc123",
      inferenceProfileName: "team-sonnet",
      type: "APPLICATION",
      status: "ACTIVE",
      models: [{ modelArn: "arn:aws:bedrock:us-east-1:1:inference-profile/x" }],
    },
    {
      inferenceProfileId: "eu.anthropic.claude-sonnet-4-6",
      type: "SYSTEM_DEFINED",
      status: "INACTIVE",
      models: [],
    },
  ];

  const catalog = buildModelCatalog(fms, profiles);
  const ids = catalog.map((m) => m.id);

  it("offers profile IDs for profile-only models and base IDs for on-demand ones", () => {
    expect(ids).toContain("us.anthropic.claude-sonnet-4-6");
    expect(ids).not.toContain("anthropic.claude-sonnet-4-6");
    expect(ids).toContain("amazon.nova-pro-v1:0");
    expect(ids).toContain("us.amazon.nova-pro-v1:0");
  });

  it("excludes non-text, non-streaming and inactive entries", () => {
    expect(ids).not.toContain("amazon.titan-embed-text-v2:0");
    expect(ids).not.toContain("us.embed.titan");
    expect(ids).not.toContain("old.model-v1");
    expect(ids).not.toContain("eu.anthropic.claude-sonnet-4-6");
  });

  it("keeps the user's application profiles and labels kinds", () => {
    const app = catalog.find((m) => m.id === "abc123");
    expect(app).toMatchObject({
      kind: "application-profile",
      name: "team-sonnet (application profile)",
    });
    expect(
      catalog.find((m) => m.id === "us.anthropic.claude-sonnet-4-6"),
    ).toMatchObject({
      kind: "inference-profile",
      name: "Claude Sonnet 4.6 (us. cross-region)",
    });
  });
});

describe("getBedrockErrorHint (discovery)", () => {
  it("explains missing list permissions", () => {
    const e = new Error(
      "User is not authorized to perform: bedrock:ListFoundationModels",
    );
    expect(getBedrockErrorHint(e, {})).toContain("type a model ID manually");
  });
  it("flags unreachable regions", () => {
    const e = new Error(
      "getaddrinfo ENOTFOUND bedrock.us-eest-1.amazonaws.com",
    );
    expect(getBedrockErrorHint(e, { region: "us-eest-1" })).toContain(
      "us-eest-1",
    );
  });
});

describe("bedrockUsageToUsage", () => {
  it("maps tokens and cache reads and writes", () => {
    expect(
      bedrockUsageToUsage({
        inputTokens: 40,
        outputTokens: 7,
        cacheReadInputTokens: 9000,
        cacheWriteInputTokens: 600,
      }),
    ).toEqual({
      promptTokens: 40,
      completionTokens: 7,
      promptTokensDetails: { cachedTokens: 9000, cacheWriteTokens: 600 },
    });
  });

  it("splits writes by lifetime from cacheDetails", () => {
    const usage = bedrockUsageToUsage({
      inputTokens: 1,
      outputTokens: 1,
      cacheWriteInputTokens: 600,
      cacheDetails: [
        { ttl: "1h", inputTokens: 500 },
        { ttl: "5m", inputTokens: 100 },
      ],
    });
    expect(usage.promptTokensDetails.cacheWriteTokens1h).toBe(500);
    expect(usage.promptTokensDetails.cacheWriteTokens5m).toBe(100);
  });

  it("leaves the split unset when cacheDetails is empty or absent", () => {
    for (const cacheDetails of [undefined, []]) {
      const usage = bedrockUsageToUsage({ inputTokens: 1, cacheDetails });
      expect(usage.promptTokensDetails.cacheWriteTokens5m).toBeUndefined();
      expect(usage.promptTokensDetails.cacheWriteTokens1h).toBeUndefined();
    }
  });

  it("defaults missing fields to zero", () => {
    expect(bedrockUsageToUsage({})).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: { cachedTokens: 0, cacheWriteTokens: 0 },
    });
  });
});

describe("bedrockSupportsOneHourCache", () => {
  it.each([
    // Every Claude row of the AWS Bedrock table lists "5 minutes, 1 hour"
    ["anthropic.claude-haiku-5-5", true],
    ["anthropic.claude-sonnet-5-5", true],
    ["anthropic.claude-opus-5-5", true],
    ["anthropic.claude-fable-5-1", true],
    ["anthropic.claude-mythos-5-1", true],
    ["anthropic.claude-fable-5", true],
    ["anthropic.claude-mythos-5", true],
    ["anthropic.claude-opus-5", true],
    ["anthropic.claude-opus-4-8", true],
    ["anthropic.claude-opus-4-7", true],
    ["anthropic.claude-opus-4-6-v1", true],
    ["global.anthropic.claude-opus-4-5-20251101-v1:0", true],
    ["anthropic.claude-sonnet-5", true],
    ["anthropic.claude-sonnet-4-6", true],
    ["us.anthropic.claude-sonnet-4-6", true],
    ["anthropic.claude-haiku-4-5-20251001-v1:0", true],
    // Not in that table: never send a ttl (it can fail the request).
    ["us.anthropic.claude-sonnet-4-5-20250929-v1:0", false],
    ["anthropic.claude-3-7-sonnet-20250219-v1:0", false],
    ["anthropic.claude-3-5-sonnet-20241022-v2:0", false],
    ["anthropic.claude-sonnet-4-20250514-v1:0", false],
    ["anthropic.claude-opus-4-1-20250805-v1:0", false],
    ["amazon.nova-pro-v1:0", false],
    ["openai.gpt-5.6-sol", false],
  ])("%s -> %s", (id, expected) => {
    expect(bedrockSupportsOneHourCache(id)).toBe(expected);
  });
});

describe("bedrockCacheTtl", () => {
  const ok = "anthropic.claude-sonnet-4-6";
  const old = "anthropic.claude-3-7-sonnet-20250219-v1:0";

  it("returns 1h only when asked for and supported", () => {
    expect(bedrockCacheTtl(ok, "1h")).toBe("1h");
    expect(bedrockCacheTtl(old, "1h")).toBeUndefined();
  });

  it("omits the ttl for the default lifetime", () => {
    expect(bedrockCacheTtl(ok, "5m")).toBeUndefined();
    expect(bedrockCacheTtl(ok, undefined)).toBeUndefined();
  });
});

describe("globalProfileStatus", () => {
  const catalog = [
    { id: "global.anthropic.claude-sonnet-4-6", kind: "inference-profile" },
    { id: "us.anthropic.claude-sonnet-4-6", kind: "inference-profile" },
    { id: "us.anthropic.claude-haiku-4-5", kind: "inference-profile" },
    { id: "global.anthropic.claude-mine", kind: "application-profile" },
  ] as const;

  it("is present when the account lists the global profile", () => {
    expect(
      globalProfileStatus([...catalog], "us.anthropic.claude-sonnet-4-6"),
    ).toBe("present");
    expect(
      globalProfileStatus([...catalog], "EU.anthropic.claude-sonnet-4-6"),
    ).toBe("present");
  });

  it("is absent when the list has the regional profile but no global one", () => {
    expect(
      globalProfileStatus([...catalog], "us.anthropic.claude-haiku-4-5"),
    ).toBe("absent");
    expect(globalProfileStatus([], "us.anthropic.claude-sonnet-4-6")).toBe(
      "absent",
    );
  });

  it("does not count a user's application profile as the global one", () => {
    expect(globalProfileStatus([...catalog], "us.anthropic.claude-mine")).toBe(
      "absent",
    );
  });

  it("is unknown for IDs it cannot ask about", () => {
    for (const id of [
      "global.anthropic.claude-sonnet-4-6",
      "anthropic.claude-3-haiku-20240307-v1:0",
      "arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/x",
      "",
    ]) {
      expect(globalProfileStatus([...catalog], id)).toBe("unknown");
    }
  });
});
