import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  dismissCacheTip,
  restoreCacheTipsForModel,
} from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { cacheTipKey, dismissedTipCount } from "../../util/cacheTips";
import { renderWithProviders } from "../../util/test/render";
import { PromptCacheButton } from "./PromptCacheButton";

const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};
const other = { ...claude, title: "Claude Sonnet (copy)" };

async function setup() {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<PromptCacheButton />, {
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
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [claude, other] },
      } as any),
    );
  });
  return { ...view, store };
}

const dismiss = (store: any, title: string, tipId: string) =>
  store.dispatch(dismissCacheTip({ key: cacheTipKey(title, tipId) }));

describe("dismissedTipCount and restoreCacheTipsForModel", () => {
  it("counts only the given model's dismissals", () => {
    const d = {
      [cacheTipKey("A", "x")]: true,
      [cacheTipKey("A", "y")]: true,
      [cacheTipKey("B", "x")]: true,
    } as const;
    expect(dismissedTipCount(d, "A")).toBe(2);
    expect(dismissedTipCount(d, "B")).toBe(1);
    expect(dismissedTipCount(d, "C")).toBe(0);
    expect(dismissedTipCount(undefined, "A")).toBe(0);
  });

  it("does not mistake a model whose title starts with another's", async () => {
    const { store } = await setup();
    dismiss(store, "Claude Sonnet", "a");
    dismiss(store, "Claude Sonnet (copy)", "a");
    expect(
      dismissedTipCount(
        store.getState().ui.dismissedCacheTips,
        "Claude Sonnet",
      ),
    ).toBe(1);
  });

  it("restores one model and leaves the others dismissed", async () => {
    const { store } = await setup();
    dismiss(store, "Claude Sonnet", "a");
    dismiss(store, "Claude Sonnet", "b");
    dismiss(store, "Claude Sonnet (copy)", "a");
    store.dispatch(restoreCacheTipsForModel({ modelTitle: "Claude Sonnet" }));
    expect(store.getState().ui.dismissedCacheTips).toEqual({
      [cacheTipKey("Claude Sonnet (copy)", "a")]: true,
    });
  });
});

describe("PromptCacheButton: show dismissed tips", () => {
  it("has no such entry when nothing was dismissed", async () => {
    const { user } = await setup();
    await user.click(screen.getByTestId("prompt-cache-button"));
    expect(screen.queryByTestId("prompt-cache-option-restore-tips")).toBeNull();
  });

  it("offers it, with the count, once a tip was dismissed for this model", async () => {
    const { user, store } = await setup();
    await act(async () => {
      dismiss(store, "Claude Sonnet", "regional-premium");
      dismiss(store, "Claude Sonnet", "one-hour-unavailable");
      dismiss(store, "Claude Sonnet (copy)", "regional-premium");
    });
    await user.click(screen.getByTestId("prompt-cache-button"));
    expect(
      screen.getByTestId("prompt-cache-option-restore-tips"),
    ).toHaveTextContent("2 hidden for this model");
  });

  it("restores this model's tips and does not change the cache setting", async () => {
    const { user, store } = await setup();
    await act(async () => {
      dismiss(store, "Claude Sonnet", "regional-premium");
      dismiss(store, "Claude Sonnet (copy)", "regional-premium");
    });
    await user.click(screen.getByTestId("prompt-cache-button"));
    await user.click(screen.getByTestId("prompt-cache-option-restore-tips"));
    expect(store.getState().ui.dismissedCacheTips).toEqual({
      [cacheTipKey("Claude Sonnet (copy)", "regional-premium")]: true,
    });
    expect(
      store.getState().ui.promptCacheSettings?.["Claude Sonnet"],
    ).toBeUndefined();
  });
});
