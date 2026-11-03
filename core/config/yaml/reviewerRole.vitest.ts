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
