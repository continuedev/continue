import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../redux/slices/configSlice";
import { setPromptCacheState } from "../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../redux/slices/uiSlice";
import { setupStore } from "../redux/store";
import { useWarmCacheNote } from "./useWarmCacheNote";

const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
} as any;

function setup(state: object | undefined, setting: "5m" | "off" = "5m") {
  const store = setupStore({ ideMessenger: new MockIdeMessenger() });
  store.dispatch(
    updateConfig({
      ...EMPTY_CONFIG,
      selectedModelByRole: {
        ...EMPTY_CONFIG.selectedModelByRole,
        chat: claude,
      },
      modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [claude] },
    }),
  );
  store.dispatch(setPromptCacheSetting({ modelTitle: claude.title, setting }));
  if (state) store.dispatch(setPromptCacheState(state as any));
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store, children });
  return { store, ...renderHook(() => useWarmCacheNote(), { wrapper }) };
}

const warm = (tokens: number) => ({
  escalated: false,
  lastRequestAt: Date.now() - 30_000,
  lastTtl: "5m",
  lastInputTokens: tokens,
});

describe("useWarmCacheNote", () => {
  it("names the size and cost while a large conversation is cached", () => {
    const { result } = setup(warm(366_000));
    expect(result.current).toContain("366k tokens");
    expect(result.current).toContain("$1.26");
    expect(result.current).toContain("warm");
  });

  it("is empty for a small conversation", () => {
    expect(setup(warm(10_000)).result.current).toBe("");
  });

  it("is empty once the cache has expired", () => {
    const state = { ...warm(366_000), lastRequestAt: Date.now() - 600_000 };
    expect(setup(state).result.current).toBe("");
  });

  it("is empty with caching off or before any request", () => {
    expect(setup(warm(366_000), "off").result.current).toBe("");
    expect(setup(undefined).result.current).toBe("");
  });

  it("goes quiet when the cache expires without a new request", () => {
    const { store, result } = setup(warm(366_000));
    expect(result.current).not.toBe("");
    act(() => {
      store.dispatch(
        setPromptCacheState({
          ...warm(366_000),
          lastRequestAt: Date.now() - 600_000,
        } as any),
      );
    });
    expect(result.current).toBe("");
  });
});
