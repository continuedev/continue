import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  setPromptCacheInputTokens,
  setPromptCacheState,
} from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { ModelSwitchCacheNotice } from "./ModelSwitchCacheNotice";

const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};
const gpt = {
  title: "GPT",
  provider: "openai",
  model: "gpt-4o",
  underlyingProviderName: "openai",
};

async function setup(model: typeof claude | typeof gpt) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  await renderWithProviders(<ModelSwitchCacheNotice />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: model,
        },
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [model] },
      } as any),
    );
    store.dispatch(
      setPromptCacheSetting({ modelTitle: model.title, setting: "auto" }),
    );
  });
  return store;
}

const warmNow = (ago = 30_000) => ({
  escalated: false,
  lastRequestAt: Date.now() - ago,
  lastTtl: "5m" as const,
});

describe("ModelSwitchCacheNotice", () => {
  it("says what switching costs while the cache is warm", async () => {
    const store = await setup(claude);
    await act(async () => {
      store.dispatch(setPromptCacheState(warmNow()));
      store.dispatch(setPromptCacheInputTokens(84_000));
    });
    const notice = screen.getByTestId("model-switch-cache-notice");
    expect(notice.textContent).toContain("84k tokens");
    expect(notice.textContent).toContain("$0.29");
  });

  it("shows nothing before a request has been made", async () => {
    await setup(claude);
    expect(screen.queryByTestId("model-switch-cache-notice")).toBeNull();
  });

  it("shows nothing once the cache has expired", async () => {
    const store = await setup(claude);
    await act(async () => {
      store.dispatch(setPromptCacheState(warmNow(10 * 60 * 1000)));
      store.dispatch(setPromptCacheInputTokens(84_000));
    });
    expect(screen.queryByTestId("model-switch-cache-notice")).toBeNull();
  });

  it("shows nothing when caching is off", async () => {
    const store = await setup(claude);
    await act(async () => {
      store.dispatch(
        setPromptCacheSetting({ modelTitle: claude.title, setting: "off" }),
      );
      store.dispatch(setPromptCacheState(warmNow()));
      store.dispatch(setPromptCacheInputTokens(84_000));
    });
    expect(screen.queryByTestId("model-switch-cache-notice")).toBeNull();
  });

  it("shows nothing for a provider that ignores the setting", async () => {
    const store = await setup(gpt);
    await act(async () => {
      store.dispatch(setPromptCacheState(warmNow()));
      store.dispatch(setPromptCacheInputTokens(84_000));
    });
    expect(screen.queryByTestId("model-switch-cache-notice")).toBeNull();
  });
});
