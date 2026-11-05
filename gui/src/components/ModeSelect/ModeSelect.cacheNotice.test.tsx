import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import { setPromptCacheState } from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { ModeSelect } from "./ModeSelect";

const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
} as any;

async function setup(lastInputTokens: number | undefined, agoMs = 30_000) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<ModeSelect />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
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
    store.dispatch(
      setPromptCacheSetting({ modelTitle: claude.title, setting: "5m" }),
    );
    store.dispatch(
      setPromptCacheState({
        escalated: false,
        lastRequestAt: Date.now() - agoMs,
        lastTtl: "5m",
        lastInputTokens,
      }),
    );
  });
  await view.user.click(screen.getByTestId("mode-select-button"));
  return view;
}

describe("ModeSwitchCacheNotice in the mode menu", () => {
  it("says a mode switch re-reads the conversation while the cache is warm", async () => {
    await setup(366_000);
    const notice = screen.getByTestId("mode-switch-cache-notice");
    expect(notice.textContent).toContain("366k tokens");
    expect(notice.textContent).toContain("own system prompt and tools");
  });

  it("is absent once the cache has expired", async () => {
    await setup(366_000, 10 * 60_000);
    expect(screen.queryByTestId("mode-switch-cache-notice")).toBeNull();
  });

  it("is absent before a request size is known", async () => {
    await setup(undefined);
    expect(screen.queryByTestId("mode-switch-cache-notice")).toBeNull();
  });
});
