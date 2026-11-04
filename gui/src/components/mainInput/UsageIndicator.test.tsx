import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  addRequestUsageToSession,
  newSession,
} from "../../redux/slices/sessionSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { UsageIndicator } from "./UsageIndicator";

const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
  contextLength: 200000,
};
const local = {
  title: "Local",
  provider: "ollama",
  model: "llama3",
  underlyingProviderName: "ollama",
  contextLength: 8192,
};

async function setup() {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  await renderWithProviders(<UsageIndicator />, {
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
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [claude, local] },
      } as any),
    );
  });
  return store;
}

describe("UsageIndicator", () => {
  it("is hidden before any request reports usage", async () => {
    await setup();
    expect(screen.queryByTestId("usage-indicator")).toBeNull();
  });

  it("shows context percent and estimated cost for a priced model", async () => {
    const store = await setup();
    await act(async () => {
      store.dispatch(
        addRequestUsageToSession({
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          usage: { promptTokens: 20000, completionTokens: 0 },
        }),
      );
    });
    const el = screen.getByTestId("usage-indicator");
    expect(el.textContent).toContain("10%");
    expect(el.textContent).toContain("$0.06");
  });

  it("shows tokens only, no cost, for an unpriced model", async () => {
    const store = await setup();
    await act(async () => {
      store.dispatch(
        addRequestUsageToSession({
          provider: "ollama",
          model: "llama3",
          usage: { promptTokens: 4096, completionTokens: 0 },
        }),
      );
    });
    const el = screen.getByTestId("usage-indicator");
    expect(el.textContent).toContain("50%");
    expect(el.textContent).not.toContain("$");
  });

  it("is reset by a new session and restored from a saved one", async () => {
    const store = await setup();
    await act(async () => {
      store.dispatch(
        addRequestUsageToSession({
          provider: "ollama",
          model: "llama3",
          usage: { promptTokens: 10, completionTokens: 1 },
        }),
      );
    });
    const saved = store.getState().session.usage;
    await act(async () => {
      store.dispatch(newSession());
    });
    expect(store.getState().session.usage).toBeUndefined();
    await act(async () => {
      store.dispatch(
        newSession({
          sessionId: "s",
          title: "t",
          workspaceDirectory: "",
          history: [],
          usage: saved,
        } as any),
      );
    });
    expect(store.getState().session.usage).toEqual(saved);
  });
});
