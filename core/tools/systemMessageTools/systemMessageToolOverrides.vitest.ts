/**
 * Defensive tests for Bug 1 (GitHub Issue: TBD):
 * toolOverrides not applied in the system message tools path.
 *
 * These tests FAIL on main and should PASS after the fix.
 *
 * The bug: llmToSerializedModelDescription() drops toolOverrides when
 * serializing BaseLLM → ModelDescription for the GUI. Without this field
 * in the serialized config, the GUI cannot apply per-model tool overrides
 * when building system message tools for models that don't support native
 * tool calling (e.g., LM Studio with capabilities: []).
 */
import { describe, expect, it } from "vitest";
import { finalToBrowserConfig } from "../../config/load.js";
import type { ContinueConfig, ILLM, ModelRole, ToolOverride } from "../..";

/**
 * Minimal LLM stub — only the fields llmToSerializedModelDescription reads.
 */
function makeLlmStub(toolOverrides?: ToolOverride[]): ILLM {
  return {
    providerName: "lmstudio",
    underlyingProviderName: "lmstudio",
    model: "test-model",
    title: "Test Model",
    toolOverrides,
    getConfigurationStatus: () => "ready",
  } as unknown as ILLM;
}

/** Minimal IDE stub — finalToBrowserConfig only calls ide.getIdeSettings(). */
const mockIde = {
  getIdeSettings: () =>
    Promise.resolve({ continueTestEnvironment: "none" }),
} as any;

/** Build a minimal ContinueConfig with the given chat model. */
function makeConfig(chatModel: ILLM): ContinueConfig {
  const roles: ModelRole[] = [
    "chat", "edit", "apply", "embed",
    "autocomplete", "rerank", "summarize", "subagent",
  ];
  const modelsByRole = Object.fromEntries(
    roles.map((r) => [r, r === "chat" ? [chatModel] : []]),
  ) as Record<ModelRole, ILLM[]>;
  const selectedModelByRole = Object.fromEntries(
    roles.map((r) => [r, r === "chat" ? chatModel : null]),
  ) as Record<ModelRole, ILLM | null>;

  return {
    tools: [],
    mcpServerStatuses: [],
    modelsByRole,
    selectedModelByRole,
    rules: [],
  } as unknown as ContinueConfig;
}

describe("finalToBrowserConfig should preserve toolOverrides on models", () => {
  it("selectedModelByRole.chat should carry toolOverrides after serialization", async () => {
    const toolOverrides: ToolOverride[] = [
      { name: "view_diff", disabled: true },
      { name: "read_file", description: "Custom description" },
    ];

    const llm = makeLlmStub(toolOverrides);
    const config = makeConfig(llm);
    const result = await finalToBrowserConfig(config, mockIde);

    // FAILS NOW: llmToSerializedModelDescription does not copy toolOverrides.
    // The serialized ModelDescription has no toolOverrides field.
    const serializedChat = result.selectedModelByRole.chat;
    expect(serializedChat).toBeDefined();
    expect((serializedChat as any).toolOverrides).toBeDefined();
    expect((serializedChat as any).toolOverrides).toHaveLength(2);
  });

  it("modelsByRole.chat entries should carry toolOverrides after serialization", async () => {
    const toolOverrides: ToolOverride[] = [
      { name: "view_diff", disabled: true },
    ];

    const llm = makeLlmStub(toolOverrides);
    const config = makeConfig(llm);
    const result = await finalToBrowserConfig(config, mockIde);

    // FAILS NOW: same serialization gap in modelsByRole path.
    const chatModels = result.modelsByRole.chat;
    expect(chatModels).toHaveLength(1);
    expect((chatModels[0] as any).toolOverrides).toBeDefined();
    expect((chatModels[0] as any).toolOverrides).toHaveLength(1);
    expect((chatModels[0] as any).toolOverrides[0].name).toBe("view_diff");
  });

  it("models without toolOverrides should serialize without the field", async () => {
    const llm = makeLlmStub(undefined);
    const config = makeConfig(llm);
    const result = await finalToBrowserConfig(config, mockIde);

    // This should pass both before and after the fix — no overrides means
    // the field is undefined, which is fine.
    const serializedChat = result.selectedModelByRole.chat;
    expect(serializedChat).toBeDefined();
    // toolOverrides should be undefined (not an empty array or error)
    expect((serializedChat as any).toolOverrides).toBeUndefined();
  });
});
