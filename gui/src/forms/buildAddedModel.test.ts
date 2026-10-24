import { describe, expect, it } from "vitest";
import { ModelPackage } from "../pages/AddNewModel/configs/models";
import { buildAddedModel } from "./buildAddedModel";

const pkg = (params: Record<string, any>): ModelPackage => ({
  title: "Some model",
  description: "d",
  params: { title: "Some model", model: "some-model", ...params },
  isOpenSource: false,
});

describe("buildAddedModel", () => {
  it("writes the selected provider and the package params", () => {
    const model = buildAddedModel({
      provider: "dothoosh",
      providerParams: { apiKey: "" },
      selectedModel: pkg({ contextLength: 1000 }),
      inputs: {},
      apiKey: "k",
    });

    expect(model).toMatchObject({
      provider: "dothoosh",
      model: "some-model",
      title: "Some model",
      contextLength: 1000,
      apiKey: "k",
    });
  });

  it("lets a package run on a different provider, such as Claude on the anthropic provider", () => {
    const model = buildAddedModel({
      provider: "dothoosh",
      providerParams: {},
      selectedModel: pkg({
        model: "claude-haiku-5-5",
        provider: "anthropic",
        apiBase: "https://gateway.dothoosh.com/anthropic/v1/",
      }),
      inputs: {},
      apiKey: "k",
    });

    expect(model).toMatchObject({
      provider: "anthropic",
      apiBase: "https://gateway.dothoosh.com/anthropic/v1/",
      model: "claude-haiku-5-5",
      apiKey: "k",
    });
  });

  it("lets the user type a model id when the catalog list is empty", () => {
    const model = buildAddedModel({
      provider: "dothoosh",
      providerParams: {},
      selectedModel: undefined,
      typedModel: "  deepseek-flash ",
      inputs: {},
      apiKey: "k",
    });

    expect(model).toMatchObject({
      provider: "dothoosh",
      model: "deepseek-flash",
      title: "deepseek-flash",
      apiKey: "k",
    });
  });

  it("returns nothing when there is neither a package nor a typed model id", () => {
    expect(
      buildAddedModel({
        provider: "dothoosh",
        providerParams: {},
        selectedModel: undefined,
        typedModel: "   ",
        inputs: {},
        apiKey: "k",
      }),
    ).toBeUndefined();
  });

  it("omits a blank api key", () => {
    const model = buildAddedModel({
      provider: "ollama",
      providerParams: {},
      selectedModel: pkg({}),
      inputs: {},
      apiKey: "",
    });

    expect(model).not.toHaveProperty("apiKey");
  });
});
