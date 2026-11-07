import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  setProfiles,
  setSelectedProfile,
} from "../../redux/slices/profilesSlice";
import { setPromptCacheState } from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import ModelSelect from "./ModelSelect";

const sonnet = {
  title: "Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
} as any;
const opus = {
  title: "Opus",
  provider: "anthropic",
  model: "claude-opus-4-8",
  underlyingProviderName: "anthropic",
} as any;
// A variant: the same model on the same server, with other settings
const sonnetFast = { ...sonnet, title: "Sonnet#fast" } as any;
const PROFILE = {
  title: "Main Config",
  id: "local",
  errors: [],
  uri: "",
  iconUrl: "",
  fullSlug: { ownerSlug: "", packageSlug: "", versionSlug: "" },
} as any;

async function setup(cache: object | undefined, extra: any[] = []) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<ModelSelect />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(setProfiles([PROFILE]));
    store.dispatch(setSelectedProfile(PROFILE.id));
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        modelsByRole: {
          ...EMPTY_CONFIG.modelsByRole,
          chat: [sonnet, opus, ...extra],
        },
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: sonnet,
        },
      }),
    );
    store.dispatch(
      setPromptCacheSetting({ modelTitle: "Sonnet", setting: "5m" }),
    );
    if (cache) store.dispatch(setPromptCacheState(cache as any));
  });
  return { ...view, store };
}

const warm = (tokens: number) => ({
  escalated: false,
  lastRequestAt: Date.now() - 30_000,
  lastTtl: "5m",
  lastInputTokens: tokens,
});

const selected = (store: Awaited<ReturnType<typeof setup>>["store"]) =>
  store.getState().config.config.selectedModelByRole.chat?.title;

async function pickOpus(user: Awaited<ReturnType<typeof setup>>["user"]) {
  await user.click(screen.getByTestId("model-select-button"));
  await user.click(await screen.findByText("Opus"));
}

describe("ModelSelect asks before throwing away a warm cache", () => {
  it("switches straight away when the cache is cold", async () => {
    const { store, user } = await setup(undefined);
    await pickOpus(user);
    expect(store.getState().ui.dialogMessage).toBeUndefined();
    expect(selected(store)).toBe("Opus");
  });

  it("switches straight away when little would be lost", async () => {
    const { store, user } = await setup(warm(10_000));
    await pickOpus(user);
    expect(store.getState().ui.dialogMessage).toBeUndefined();
    expect(selected(store)).toBe("Opus");
  });

  it("asks first when a large conversation is cached", async () => {
    const { store, user } = await setup(warm(366_000));
    await pickOpus(user);
    const dialog = store.getState().ui.dialogMessage as any;
    expect(dialog).toBeDefined();
    expect(dialog.props.loss.tokens).toBe(366_000);
    expect(dialog.props.from).toBe("Sonnet");
    expect(dialog.props.to).toBe("Opus");
    // nothing has changed yet
    expect(selected(store)).toBe("Sonnet");
  });

  it("switches only when confirmed", async () => {
    const { store, user } = await setup(warm(366_000));
    await pickOpus(user);
    await act(async () => {
      (store.getState().ui.dialogMessage as any).props.onSwitch();
    });
    expect(selected(store)).toBe("Opus");
  });

  it("does not ask when switching to a variant of the same model", async () => {
    const { store, user } = await setup(warm(366_000), [sonnetFast]);
    await user.click(screen.getByTestId("model-select-button"));
    await user.click(await screen.findByText("Sonnet#fast"));
    expect(store.getState().ui.dialogMessage).toBeUndefined();
    expect(selected(store)).toBe("Sonnet#fast");
  });

  it("asks for the keyboard shortcut too", async () => {
    const { store } = await setup(warm(366_000));
    await act(async () => {
      fireEvent.keyDown(window, { key: "'", metaKey: true, ctrlKey: true });
    });
    expect(store.getState().ui.dialogMessage).toBeDefined();
    expect(selected(store)).toBe("Sonnet");
  });
});
