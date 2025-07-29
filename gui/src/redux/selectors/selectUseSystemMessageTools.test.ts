import { ModelDescription } from "core";
import { describe, expect, test, vi } from "vitest";
import { RootState } from "../store";

// Mock the shouldAutoEnableSystemMessageTools function
vi.mock("core/config/shouldAutoEnableSystemMessageTools", () => ({
  shouldAutoEnableSystemMessageTools: vi.fn((model: ModelDescription) => {
    if (model.provider === "openrouter") {
      return !model.model.toLowerCase().includes("claude");
    }
    return undefined; // No auto-preference for other providers
  }),
}));

// Mock the selectSelectedChatModel selector - we'll control its return value in tests
vi.mock("../slices/configSlice", () => ({
  selectSelectedChatModel: vi.fn(),
}));

// Import after mocking
import { selectSelectedChatModel } from "../slices/configSlice";
import { selectUseSystemMessageTools } from "./selectUseSystemMessageTools";

describe("selectUseSystemMessageTools", () => {
  const mockSelectSelectedChatModel = selectSelectedChatModel as any;

  const createMockState = (manualSetting?: boolean): RootState => {
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
    mockSelectSelectedChatModel.mockReturnValue(
      createModel("openrouter", "gpt-4"),
    );
    const state = createMockState(false);
    expect(selectUseSystemMessageTools(state)).toBe(true);
  });

  test("auto-detection takes priority: OpenRouter Claude returns false even with manual true", () => {
    mockSelectSelectedChatModel.mockReturnValue(
      createModel("openrouter", "claude-3.5-sonnet"),
    );
    const state = createMockState(true);
    expect(selectUseSystemMessageTools(state)).toBe(false);
  });

  test("falls back to manual setting when no auto-preference: manual true", () => {
    mockSelectSelectedChatModel.mockReturnValue(createModel("openai", "gpt-4"));
    const state = createMockState(true);
    expect(selectUseSystemMessageTools(state)).toBe(true);
  });

  test("falls back to manual setting when no auto-preference: manual false", () => {
    mockSelectSelectedChatModel.mockReturnValue(
      createModel("anthropic", "claude-3.5-sonnet"),
    );
    const state = createMockState(false);
    expect(selectUseSystemMessageTools(state)).toBe(false);
  });

  test("defaults to false when no auto-preference and no manual setting", () => {
    mockSelectSelectedChatModel.mockReturnValue(
      createModel("groq", "llama-3.3-70b"),
    );
    const state = createMockState(undefined);
    expect(selectUseSystemMessageTools(state)).toBe(false);
  });

  test("handles missing selected model: uses manual setting", () => {
    mockSelectSelectedChatModel.mockReturnValue(undefined);
    const state = createMockState(true);
    expect(selectUseSystemMessageTools(state)).toBe(true);
  });

  test("handles missing selected model: defaults to false when no manual setting", () => {
    mockSelectSelectedChatModel.mockReturnValue(undefined);
    const state = createMockState(undefined);
    expect(selectUseSystemMessageTools(state)).toBe(false);
  });

  test("auto-enable works for various OpenRouter models", () => {
    mockSelectSelectedChatModel.mockReturnValue(
      createModel("openrouter", "gpt-4o"),
    );
    expect(selectUseSystemMessageTools(createMockState(false))).toBe(true);

    mockSelectSelectedChatModel.mockReturnValue(
      createModel("openrouter", "llama-3.3-70b"),
    );
    expect(selectUseSystemMessageTools(createMockState(false))).toBe(true);

    mockSelectSelectedChatModel.mockReturnValue(
      createModel("openrouter", "claude-haiku"),
    );
    expect(selectUseSystemMessageTools(createMockState(true))).toBe(false);
  });
});
