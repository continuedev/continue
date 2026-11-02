import { describe, expect, it } from "vitest";
import { providers } from "../pages/AddNewModel/configs/providers";
import {
  areRequiredFieldsFilled,
  buildModelFromForm,
  getBedrockConnectionParams,
  getRenderableFields,
} from "./addModelFormUtils";

const bedrock = providers["bedrock"]!;
const sonnet = bedrock.packages[0];
const keys = (v: Record<string, any>) =>
  getRenderableFields(bedrock, v).map((f) => f.key);

describe("Bedrock add-model form", () => {
  it("defaults to the API key flow", () => {
    expect(keys({})).toEqual(
      expect.arrayContaining([
        "authMode",
        "apiKey",
        "region",
        "crossRegionInference",
        "model",
      ]),
    );
    expect(keys({})).not.toContain("profile");
    expect(keys({})).not.toContain("accessKeyId");
  });

  it("shows only profile fields for the SSO flow", () => {
    const k = keys({ authMode: "profile" });
    expect(k).toContain("profile");
    expect(k).not.toContain("apiKey");
    expect(k).not.toContain("secretAccessKey");
  });

  it("shows key fields incl. optional session token for the keys flow", () => {
    const k = keys({ authMode: "keys" });
    expect(k).toEqual(
      expect.arrayContaining([
        "accessKeyId",
        "secretAccessKey",
        "sessionToken",
      ]),
    );
  });

  it("requires only the fields of the chosen flow", () => {
    expect(areRequiredFieldsFilled(bedrock, {})).toBe(false);
    expect(areRequiredFieldsFilled(bedrock, { apiKey: "abc" })).toBe(true);
    expect(areRequiredFieldsFilled(bedrock, { authMode: "profile" })).toBe(
      false,
    );
    expect(
      areRequiredFieldsFilled(bedrock, {
        authMode: "profile",
        profile: "work",
      }),
    ).toBe(true);
    expect(areRequiredFieldsFilled(bedrock, { authMode: "default" })).toBe(
      true,
    );
    expect(
      areRequiredFieldsFilled(bedrock, { authMode: "keys", accessKeyId: "A" }),
    ).toBe(false);
  });

  it("builds a profile config without stale credentials or UI-only fields", () => {
    const model = buildModelFromForm(bedrock, sonnet, {
      authMode: "profile",
      profile: "work",
      apiKey: "stale-key",
      accessKeyId: "stale",
      region: "eu-west-1",
      crossRegionInference: "auto",
      model: "",
    });
    expect(model).toMatchObject({
      provider: "bedrock",
      profile: "work",
      region: "eu-west-1",
      crossRegionInference: "auto",
      model: sonnet.params.model,
    });
    expect(model).not.toHaveProperty("apiKey");
    expect(model).not.toHaveProperty("accessKeyId");
    expect(model).not.toHaveProperty("authMode");
  });

  it("uses defaults, omits cross-region when off, and honours a custom model ID", () => {
    const model = buildModelFromForm(bedrock, sonnet, {
      apiKey: "k",
      crossRegionInference: "off",
      model: "anthropic.claude-custom-v1:0",
    });
    expect(model.apiKey).toBe("k");
    expect(model.region).toBe("us-east-1");
    expect(model).not.toHaveProperty("crossRegionInference");
    expect(model.model).toBe("anthropic.claude-custom-v1:0");
  });
});

describe("legacy providers are unaffected", () => {
  const azure = providers["azure"]!;
  it("still requires apiKey-less required fields and includes them", () => {
    expect(areRequiredFieldsFilled(azure, {})).toBe(false);
    const model = buildModelFromForm(azure, azure.packages[0], {
      apiKey: "k",
      deployment: "d",
      apiBase: "https://x",
    });
    expect(model).toMatchObject({
      apiKey: "k",
      deployment: "d",
      provider: "azure",
    });
  });
});

describe("getBedrockConnectionParams", () => {
  it("returns only the active auth flow's connection settings", () => {
    const params = getBedrockConnectionParams(bedrock, sonnet, {
      authMode: "profile",
      profile: "work",
      apiKey: "stale",
      region: "eu-west-1",
      crossRegionInference: "off",
    });
    expect(params).toEqual({ profile: "work", region: "eu-west-1" });
  });

  it("honours an overridden title via buildModelFromForm options", () => {
    const model = buildModelFromForm(
      bedrock,
      sonnet,
      { apiKey: "k" },
      { title: "Nova Pro (Bedrock)" },
    );
    expect(model.title).toBe("Nova Pro (Bedrock)");
  });
});

describe("Amazon Bedrock (Mantle) wizard entry", () => {
  const mantle = providers["bedrock-mantle"]!;
  const gptOss = mantle.packages[0];

  it("needs an API key and region", () => {
    expect(areRequiredFieldsFilled(mantle, {})).toBe(false);
    expect(areRequiredFieldsFilled(mantle, { apiKey: "k" })).toBe(true);
  });

  it("only offers Mantle regions, defaulting to us-east-1", () => {
    const region = mantle.collectInputFor!.find((f) => f.key === "region")!;
    const values = region.choices!.map((c) => c.value);
    expect(region.defaultValue).toBe("us-east-1");
    expect(values).toContain("eu-west-1");
    expect(values).not.toContain("eu-west-3"); // Paris has no Mantle endpoint
    expect(values).not.toContain("ap-southeast-1");
  });

  it("saves a bedrock-mantle model with the key and region", () => {
    const model = buildModelFromForm(mantle, gptOss, {
      apiKey: "bedrock-key",
      region: "eu-west-1",
    });
    expect(model).toMatchObject({
      provider: "bedrock-mantle",
      model: "openai.gpt-oss-120b",
      apiKey: "bedrock-key",
      region: "eu-west-1",
    });
  });

  it("honours a custom model ID", () => {
    const model = buildModelFromForm(mantle, gptOss, {
      apiKey: "k",
      model: "qwen.qwen3-coder",
    });
    expect(model.model).toBe("qwen.qwen3-coder");
  });

  it("tests the connection against the Mantle endpoint", () => {
    expect(
      getBedrockConnectionParams(mantle, gptOss, {
        apiKey: "k",
        region: "us-west-2",
      }),
    ).toEqual({ apiKey: "k", region: "us-west-2", endpoint: "mantle" });
  });

  it("does not mark standard Bedrock connections as Mantle", () => {
    const params = getBedrockConnectionParams(bedrock, sonnet, { apiKey: "k" });
    expect(params).not.toHaveProperty("endpoint");
  });
});
