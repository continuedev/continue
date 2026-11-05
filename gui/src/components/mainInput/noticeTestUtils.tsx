import type { JSX } from "react";
import { act, screen } from "@testing-library/react";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  newSession,
  setMode,
  setPromptCacheState,
} from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";

// Tests import these from here as well, so they need one place to come from.
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { act, screen, setPromptCacheState };

export const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};

/** Renders a component in a store holding a Claude model and one chat message. */
export async function setupNotice(
  component: JSX.Element,
  /** The toolbar choice; null leaves it unset, as in a fresh install. */
  setting: "auto" | "5m" | "1h" | "off" | null = "5m",
  /**
   * The session's mode. A fresh session is in Agent, where caching is on by
   * default when nothing is chosen; use "chat" for the case where it is off.
   */
  mode?: "chat" | "agent" | "plan" | "background",
) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(component, {
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
      } as any),
    );
    if (setting !== null) {
      store.dispatch(
        setPromptCacheSetting({ modelTitle: claude.title, setting }),
      );
    }
    store.dispatch(
      newSession({
        sessionId: "test-session",
        title: "Test",
        workspaceDirectory: "",
        history: [
          {
            message: { role: "user", content: "hi" },
            contextItems: [],
          },
        ],
      } as any),
    );
    if (mode) store.dispatch(setMode(mode));
  });
  return { ...view, store, ideMessenger };
}

/** Cache state for a request that started `minutesAgo` minutes ago. */
export const requestedAgo = (minutesAgo: number, extra = {}) => ({
  escalated: false,
  lastRequestAt: Date.now() - minutesAgo * 60_000,
  lastTtl: "5m" as const,
  lastInputTokens: 366_000,
  ...extra,
});
