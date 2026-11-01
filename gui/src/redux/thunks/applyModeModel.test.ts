import { describe, expect, it } from "vitest";
import { EMPTY_CONFIG } from "../slices/configSlice";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { applyModeModel } from "./applyModeModel";

const model = (title: string) =>
  ({ title, model: title, provider: "bedrock" }) as any;
const profile = { id: "local" } as any;

function setup(overrides: Record<string, string> = {}, selected = "Sonnet") {
  const base = getEmptyRootState();
  const chat = [model("Opus"), model("Sonnet"), model("Haiku")];
  const store = createMockStore({
    config: {
      ...base.config,
      config: {
        ...EMPTY_CONFIG,
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat },
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: chat.find((m) => m.title === selected)!,
        },
        modeModels: {
          plan: { title: "Opus", reasoningEffort: "medium" },
          agent: { title: "Sonnet" },
        },
      },
    },
    ui: { ...base.ui, modeModelOverrides: overrides },
  });
  const posts: any[] = [];
  store.mockIdeMessenger.post = ((type: string, data: any) => {
    posts.push([type, data]);
  }) as any;
  return { store, posts };
}

describe("applyModeModel", () => {
  it("switches the chat model to the mode's model", async () => {
    const { store, posts } = setup();
    await (store.dispatch as any)(
      applyModeModel({ mode: "plan", selectedProfile: profile }),
    );
    expect(
      (store.getState() as any).config.config.selectedModelByRole.chat.title,
    ).toBe("Opus");
    expect(posts).toContainEqual([
      "config/updateSelectedModel",
      { role: "chat", profileId: "local", title: "Opus" },
    ]);
  });

  it("does nothing when the model is already selected", async () => {
    const { store, posts } = setup();
    await (store.dispatch as any)(
      applyModeModel({ mode: "agent", selectedProfile: profile }),
    );
    expect(posts).toEqual([]);
  });

  it("keeps the current model for modes without an entry", async () => {
    const { store, posts } = setup();
    await (store.dispatch as any)(
      applyModeModel({ mode: "chat", selectedProfile: profile }),
    );
    expect(posts).toEqual([]);
    expect(
      (store.getState() as any).config.config.selectedModelByRole.chat.title,
    ).toBe("Sonnet");
  });

  it("prefers the user's manual pick for the mode", async () => {
    const { store } = setup({ plan: "Haiku" });
    await (store.dispatch as any)(
      applyModeModel({ mode: "plan", selectedProfile: profile }),
    );
    expect(
      (store.getState() as any).config.config.selectedModelByRole.chat.title,
    ).toBe("Haiku");
  });

  it("ignores a configured model that no longer exists", async () => {
    const { store, posts } = setup({ plan: "Gone" });
    await (store.dispatch as any)(
      applyModeModel({ mode: "plan", selectedProfile: profile }),
    );
    expect(posts).toEqual([]);
  });
});
