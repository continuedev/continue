import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  setProfiles,
  setSelectedProfile,
} from "../../redux/slices/profilesSlice";
import { setMode } from "../../redux/slices/sessionSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import ModelSelect from "./ModelSelect";

const model = (title: string) =>
  ({
    title,
    model: title,
    provider: "openai",
    underlyingProviderName: "openai",
  }) as any;

const PROFILE = {
  title: "Main Config",
  id: "local",
  errors: [],
  uri: "",
  iconUrl: "",
  fullSlug: { ownerSlug: "", packageSlug: "", versionSlug: "" },
} as any;

const ALL = ["Alpha", "Bravo", "Charlie", "Delta"].map(model);

async function setup(
  planTitles: string[] | undefined,
  selected = "Alpha",
  mode: "chat" | "plan" | "agent" = "plan",
) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<ModelSelect />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(setProfiles([PROFILE]));
    store.dispatch(setSelectedProfile(PROFILE.id));
    store.dispatch(setMode(mode));
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: ALL },
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: ALL.find((m) => m.title === selected) ?? null,
        },
        ...(planTitles
          ? {
              modeModels: {
                plan: { title: planTitles[0], titles: planTitles },
              },
            }
          : {}),
      }),
    );
  });
  return { ...view, store };
}

const selectedTitle = (store: Awaited<ReturnType<typeof setup>>["store"]) =>
  store.getState().config.config.selectedModelByRole.chat?.title;

const pressCmdQuote = () =>
  act(async () => {
    fireEvent.keyDown(window, { key: "'", metaKey: true, ctrlKey: true });
  });

describe("ModelSelect with a per-mode list", () => {
  it("shows the mode's models first, then the rest under All models", async () => {
    const { user } = await setup(["Charlie", "Alpha"]);
    await user.click(screen.getByTestId("model-select-button"));
    expect(screen.getByTestId("model-group-mode").textContent).toBe(
      "Plan models",
    );
    expect(screen.getByTestId("model-group-all").textContent).toBe(
      "All models",
    );
    // Read the order from the open listbox, not the whole page: the button
    // label also contains the selected model's name.
    const listbox = screen.getByRole("listbox");
    const text = listbox.textContent ?? "";
    const at = (t: string) => text.indexOf(t);
    expect(at("Plan models")).toBeGreaterThanOrEqual(0);
    expect(at("Plan models")).toBeLessThan(at("Charlie"));
    // Offered models are in the configured order, ahead of "All models".
    expect(at("Charlie")).toBeLessThan(at("Alpha"));
    expect(at("Alpha")).toBeLessThan(at("All models"));
    expect(at("All models")).toBeLessThan(at("Bravo"));
    expect(at("Bravo")).toBeLessThan(at("Delta"));
  });

  it("shows no group headings when the mode has no list", async () => {
    const { user } = await setup(undefined);
    await user.click(screen.getByTestId("model-select-button"));
    expect(screen.queryByTestId("model-group-mode")).toBeNull();
    expect(screen.queryByTestId("model-group-all")).toBeNull();
    expect(screen.getByText("Bravo")).toBeTruthy();
  });

  it("shows no group headings in a mode other than the configured one", async () => {
    const { user } = await setup(["Charlie", "Alpha"], "Alpha", "agent");
    await user.click(screen.getByTestId("model-select-button"));
    expect(screen.queryByTestId("model-group-mode")).toBeNull();
  });

  it("omits the All models heading when the list covers every model", async () => {
    const { user } = await setup(["Alpha", "Bravo", "Charlie", "Delta"]);
    await user.click(screen.getByTestId("model-select-button"));
    expect(screen.getByTestId("model-group-mode")).toBeTruthy();
    expect(screen.queryByTestId("model-group-all")).toBeNull();
  });

  it("Cmd+' cycles only the mode's models and wraps", async () => {
    const { store } = await setup(["Charlie", "Alpha"], "Charlie");
    await pressCmdQuote();
    expect(selectedTitle(store)).toBe("Alpha");
    await pressCmdQuote();
    expect(selectedTitle(store)).toBe("Charlie");
  });

  it("Cmd+' starts at the mode's first model when a hand-picked one is not offered", async () => {
    const { store } = await setup(["Charlie", "Alpha"], "Delta");
    await pressCmdQuote();
    expect(selectedTitle(store)).toBe("Charlie");
  });

  it("Cmd+' cycles every model when the mode has no list (as before)", async () => {
    const { store } = await setup(undefined, "Alpha");
    await pressCmdQuote();
    const first = selectedTitle(store);
    expect(["Bravo", "Charlie", "Delta"]).toContain(first);
    expect(first).not.toBe("Alpha");
  });
});
