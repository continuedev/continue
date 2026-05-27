import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Config, IDE, IdeInfo, IdeSettings, ILLMLogger } from "..";
import { BaseLLM } from "../llm";

import { intermediateToFinalConfig } from "./load";

vi.mock("../llm", () => ({
  BaseLLM: class {},
}));

vi.mock("../llm/llms", () => ({
  LLMClasses: [],
  llmFromDescription: vi.fn(),
}));

vi.mock("../llm/llms/CustomLLM", () => ({
  default: class {
    constructor(public _opts: any) {}
  },
}));

vi.mock("../llm/llms/llm", () => ({
  LLMReranker: class {
    constructor(public _llm: any) {}
  },
}));

vi.mock("../llm/llms/TransformersJsEmbeddingsProvider", () => ({
  default: class {
    providerName = "transformers.js";
  },
}));

// Avoid pulling in @continuedev/fetch (CJS follow-redirects) via the legacy
// slash-command barrel — we don't exercise slash commands in these tests.
vi.mock("../commands/slash/built-in-legacy", () => ({
  getLegacyBuiltInSlashCommandFromDescription: vi.fn(() => undefined),
}));

// Avoid pulling in @continuedev/terminal-security (CJS shell-quote) via the
// tools barrel — we don't exercise tool definitions in these tests.
vi.mock("../tools", () => ({
  getBaseToolDefinitions: () => [],
  serializeTool: (t: any) => t,
}));

vi.mock("../context/mcp/json/loadJsonMcpConfigs", () => ({
  loadJsonMcpConfigs: vi.fn().mockResolvedValue({ errors: [], mcpServers: [] }),
}));

vi.mock("./loadContextProviders", () => ({
  loadConfigContextProviders: vi.fn().mockReturnValue({
    providers: [],
    errors: [],
  }),
}));

let llmFromDescriptionMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  const { llmFromDescription } = await import("../llm/llms");
  llmFromDescriptionMock = llmFromDescription as ReturnType<typeof vi.fn>;
});

function makeFakeLlm(overrides: Partial<BaseLLM> & { model: string }): BaseLLM {
  return {
    model: overrides.model,
    title: overrides.title ?? overrides.model,
    providerName: overrides.providerName ?? "openai",
    listModels: overrides.listModels ?? (async () => []),
    isFromAutoDetect: overrides.isFromAutoDetect ?? false,
  } as unknown as BaseLLM;
}

function makeArgs(config: Partial<Config>) {
  const ide: IDE = {
    getWorkspaceDirs: async () => [],
    readFile: async () => "",
    getIdeSettings: async () => ({}) as IdeSettings,
    showToast: async () => undefined,
  } as unknown as IDE;

  const baseConfig: Config = {
    models: [],
    ...config,
  } as unknown as Config;

  return {
    config: baseConfig,
    ide,
    ideSettings: {} as IdeSettings,
    ideInfo: { ideType: "jetbrains" } as IdeInfo,
    uniqueId: "test-unique-id",
    llmLogger: { log: vi.fn() } as unknown as ILLMLogger,
    workOsAccessToken: undefined,
    loadPromptFiles: false,
  };
}

describe("intermediateToFinalConfig — tabAutocompleteModel AUTODETECT expansion", () => {
  beforeEach(() => {
    llmFromDescriptionMock.mockReset();
  });

  it("expands an AUTODETECT tabAutocompleteModel into the provider's real model list (regression for #12400)", async () => {
    llmFromDescriptionMock.mockImplementation(async (desc: any) => {
      if (desc.model === "AUTODETECT") {
        return makeFakeLlm({
          model: "AUTODETECT",
          providerName: "openai",
          listModels: async () => ["model-a", "model-b"],
        });
      }
      return makeFakeLlm({
        model: desc.model,
        title: desc.title ?? desc.model,
        providerName: "openai",
        isFromAutoDetect: desc.isFromAutoDetect,
      });
    });

    const { config: result } = await intermediateToFinalConfig(
      makeArgs({
        tabAutocompleteModel: {
          title: "auto",
          provider: "openai",
          model: "AUTODETECT",
          apiBase: "https://example.invalid/v1",
        } as any,
      }),
    );

    const autocomplete = result.modelsByRole.autocomplete;
    expect(autocomplete).toHaveLength(2);
    expect(autocomplete.every((m) => m.model !== "AUTODETECT")).toBe(true);
    expect(autocomplete.map((m) => m.model).sort()).toEqual([
      "model-a",
      "model-b",
    ]);
    expect(autocomplete.every((m) => m.isFromAutoDetect === true)).toBe(true);
  });

  it("uses the configured model unchanged when it is not AUTODETECT", async () => {
    llmFromDescriptionMock.mockImplementation(async (desc: any) =>
      makeFakeLlm({
        model: desc.model,
        title: desc.title ?? desc.model,
        providerName: "openai",
      }),
    );

    const { config: result } = await intermediateToFinalConfig(
      makeArgs({
        tabAutocompleteModel: {
          title: "auto",
          provider: "openai",
          model: "qwen-7b",
          apiBase: "https://example.invalid/v1",
        } as any,
      }),
    );

    const autocomplete = result.modelsByRole.autocomplete;
    expect(autocomplete).toHaveLength(1);
    expect(autocomplete[0].model).toBe("qwen-7b");
  });

  it("drops the AUTODETECT placeholder when listModels() rejects (does not leak it into autocomplete)", async () => {
    llmFromDescriptionMock.mockImplementation(async (desc: any) => {
      if (desc.model === "AUTODETECT") {
        return makeFakeLlm({
          model: "AUTODETECT",
          providerName: "openai",
          listModels: async () => {
            throw new Error("listModels failed");
          },
        });
      }
      return makeFakeLlm({
        model: desc.model,
        title: desc.title ?? desc.model,
        providerName: "openai",
      });
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { config: result } = await intermediateToFinalConfig(
      makeArgs({
        tabAutocompleteModel: {
          title: "auto",
          provider: "openai",
          model: "AUTODETECT",
          apiBase: "https://example.invalid/v1",
        } as any,
      }),
    );

    expect(result.modelsByRole.autocomplete).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
