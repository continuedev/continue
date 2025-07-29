import { ModelDescription } from "core";
import { describe, expect, test, vi } from "vitest";
import { RootState } from "../store";
import { selectUseSystemMessageTools } from "./selectUseSystemMessageTools";

// Mock the shouldAutoEnableSystemMessageTools function
vi.mock("core/config/shouldAutoEnableSystemMessageTools", () => ({
  shouldAutoEnableSystemMessageTools: vi.fn((model: ModelDescription) => {
    if (model.provider === "openrouter") {
      return !model.model.toLowerCase().includes("claude");
    }
    return undefined; // No auto-preference for other providers
  }),
}));

// Mock the selectSelectedChatModel selector
const mockSelectSelectedChatModel = vi.fn();
vi.mock("../slices/configSlice", () => ({
  selectSelectedChatModel: mockSelectSelectedChatModel,
}));

describe("selectUseSystemMessageTools", () => {
  const createMockState = (
    manualSetting?: boolean,
    selectedModel?: ModelDescription,
  ): RootState => {
    // Set up the mock to return the selected model for this test
    mockSelectSelectedChatModel.mockReturnValue(selectedModel);

    return {
      config: {
        config: {
          experimental: {
            onlyUseSystemMessageTools: manualSetting,
          },
        },
      },
    } as any;
  };

  const createModel = (provider: string, model: string): ModelDescription => ({
    title: "Test Model",
    provider,
    underlyingProviderName: provider,
    model,
  });

  test("auto-detection takes priority: OpenRouter non-Claude returns true even with manual false", () => {
    const state = createMockState(false, createModel("openrouter", "gpt-4"));
    expect(selectUseSystemMessageTools(state)).toBe(true);
  });

  test("auto-detection takes priority: OpenRouter Claude returns false even with manual true", () => {
    const state = createMockState(
      true,
      createModel("openrouter", "claude-3.5-sonnet"),
    );
    expect(selectUseSystemMessageTools(state)).toBe(false);
  });

  test("falls back to manual setting when no auto-preference: manual true", () => {
    const state = createMockState(true, createModel("openai", "gpt-4"));
    expect(selectUseSystemMessageTools(state)).toBe(true);
  });

  test("falls back to manual setting when no auto-preference: manual false", () => {
    const state = createMockState(
      false,
      createModel("anthropic", "claude-3.5-sonnet"),
    );
    expect(selectUseSystemMessageTools(state)).toBe(false);
  });

  test("defaults to false when no auto-preference and no manual setting", () => {
    const state = createMockState(
      undefined,
      createModel("groq", "llama-3.3-70b"),
    );
    expect(selectUseSystemMessageTools(state)).toBe(false);
  });

  test("handles missing selected model: uses manual setting", () => {
    const state = createMockState(true, undefined);
    expect(selectUseSystemMessageTools(state)).toBe(true);
  });

  test("handles missing selected model: defaults to false when no manual setting", () => {
    const state = createMockState(undefined, undefined);
    expect(selectUseSystemMessageTools(state)).toBe(false);
  });

  test("auto-enable works for various OpenRouter models", () => {
    expect(
      selectUseSystemMessageTools(
        createMockState(false, createModel("openrouter", "gpt-4o")),
      ),
    ).toBe(true);
    expect(
      selectUseSystemMessageTools(
        createMockState(false, createModel("openrouter", "llama-3.3-70b")),
      ),
    ).toBe(true);
    expect(
      selectUseSystemMessageTools(
        createMockState(true, createModel("openrouter", "claude-haiku")),
      ),
    ).toBe(false);
  });
});
