import { describe, expect, it, vi } from "vitest";

import { IDE, IdeInfo, ILLMLogger } from "../..";
import { configYamlToContinueConfig } from "./loadYaml";
import { rectifySelectedModelsFromGlobalContext } from "../selectedModels";

const ide = {
  getWorkspaceDirs: async () => [],
  fileExists: async () => false,
  readFile: async () => "",
  readSecrets: async () => ({}),
  listDir: async () => [],
  getFileResults: async () => "",
  getIdeInfo: async () => ({ ideType: "vscode" }),
} as unknown as IDE;
const ideInfo = { ideType: "vscode" } as unknown as IdeInfo;
const llmLogger = { createInteractionLog: vi.fn() } as unknown as ILLMLogger;

async function load(models: object[], toolPermissions?: object) {
  return configYamlToContinueConfig({
    unrolledAssistant: {
      name: "t",
      version: "1.0.0",
      models,
      ...(toolPermissions ? { toolPermissions } : {}),
    } as any,
    ide,
    ideInfo,
    uniqueId: "test",
    llmLogger,
  });
}

const chatModel = {
  name: "Chat",
  provider: "openai",
  model: "gpt-4.1",
  apiKey: "k",
};
const reviewModel = {
  name: "Reviewer",
  provider: "openai",
  model: "gpt-4.1-mini",
  apiKey: "k",
  roles: ["reviewer"],
};

describe("reviewer model role", () => {
  it("lists only models that opt in with roles: [reviewer]", async () => {
    const { config } = await load([chatModel, reviewModel]);
    expect(config?.modelsByRole.reviewer.map((m) => m.title)).toEqual([
      "Reviewer",
    ]);
    // A model that says reviewer only is not a chat model.
    expect(config?.modelsByRole.chat.map((m) => m.title)).toEqual(["Chat"]);
  });

  it("does not make a model with no roles a reviewer", async () => {
    const { config } = await load([chatModel]);
    expect(config?.modelsByRole.reviewer).toEqual([]);
    expect(config?.selectedModelByRole.reviewer).toBeNull();
  });

  it("selects nothing when no model opted in, never falling back to chat", async () => {
    const { config } = await load([chatModel]);
    const selected = rectifySelectedModelsFromGlobalContext(config!, "p");
    expect(selected.selectedModelByRole.chat?.title).toBe("Chat");
    expect(selected.selectedModelByRole.reviewer).toBeNull();
  });

  it("selects the opted-in model", async () => {
    const { config } = await load([chatModel, reviewModel]);
    const selected = rectifySelectedModelsFromGlobalContext(config!, "p");
    expect(selected.selectedModelByRole.reviewer?.title).toBe("Reviewer");
  });

  it("carries toolPermissions.auto through to the config", async () => {
    const { config } = await load([chatModel], {
      auto: { limits: { totalDenials: 5 } },
    });
    expect(config?.toolPermissions?.auto?.limits?.totalDenials).toBe(5);
  });
});

describe("modeModels.reviewer", () => {
  async function loadWith(modeModels: object) {
    return configYamlToContinueConfig({
      unrolledAssistant: {
        name: "t",
        version: "1.0.0",
        models: [chatModel, reviewModel],
        modeModels,
      } as any,
      ide,
      ideInfo,
      uniqueId: "test",
      llmLogger,
    });
  }

  it("selects the named model as the reviewer, adding it to the role if needed", async () => {
    const { config, errors } = await loadWith({
      reviewer: { model: "Chat", reasoningEffort: "low" },
    });
    expect(errors ?? []).toEqual([]);
    expect(config?.selectedModelByRole.reviewer?.title).toBe("Chat");
    expect(config?.modelsByRole.reviewer.map((m) => m.title)).toEqual([
      "Chat",
      "Reviewer",
    ]);
    expect(config?.modeModels?.reviewer).toEqual({
      title: "Chat",
      reasoningEffort: "low",
    });
  });

  it("wins over the saved pick when selections are restored", async () => {
    const { config } = await loadWith({ reviewer: { model: "Chat" } });
    const selected = rectifySelectedModelsFromGlobalContext(config!, "p");
    expect(selected.selectedModelByRole.reviewer?.title).toBe("Chat");
  });

  it("an unknown name is reported and the role's own model stays selected", async () => {
    const { config, errors } = await loadWith({ reviewer: { model: "Nope" } });
    expect(errors?.map((e) => e.message)).toEqual([
      expect.stringContaining('modeModels.reviewer: no model named "Nope"'),
    ]);
    const selected = rectifySelectedModelsFromGlobalContext(config!, "p");
    expect(selected.selectedModelByRole.reviewer?.title).toBe("Reviewer");
  });
});
