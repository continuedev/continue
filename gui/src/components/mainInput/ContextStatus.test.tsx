import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  newSession,
  setContextPercentage,
  setPromptCacheState,
} from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import ContextStatus from "./ContextStatus";

const sonnet = {
  title: "Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
} as any;
const haiku55 = {
  title: "Haiku 5.5",
  provider: "bedrock",
  model: "us.anthropic.claude-haiku-5-5",
  underlyingProviderName: "bedrock",
} as any;

async function setup(model: any, tokens: number | undefined, percent = 0.2) {
  // jsdom has no IntersectionObserver, which the tooltip's positioning needs.
  if (!("IntersectionObserver" in globalThis)) {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
  }
  // ToolTip renders into this element; the app's index.html provides it.
  if (!document.getElementById("tooltip-portal-div")) {
    const portal = document.createElement("div");
    portal.id = "tooltip-portal-div";
    document.body.appendChild(portal);
  }
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<ContextStatus />, {
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
      }),
    );
    store.dispatch(
      setPromptCacheSetting({ modelTitle: model.title, setting: "5m" }),
    );
    store.dispatch(
      newSession({
        sessionId: "s",
        title: "t",
        workspaceDirectory: "",
        history: [
          { message: { role: "user", content: "hi" }, contextItems: [] },
        ],
      } as any),
    );
    store.dispatch(setContextPercentage(percent));
    store.dispatch(
      setPromptCacheState({
        escalated: false,
        lastRequestAt: Date.now() - 1000,
        lastTtl: "5m",
        lastInputTokens: tokens,
      }),
    );
  });
  return { ...view, store };
}

describe("ContextStatus", () => {
  it("stays hidden for a small conversation", async () => {
    const { container } = await setup(sonnet, 50_000, 0.05);
    expect(container.querySelector("div > div")).toBeNull();
  });

  it("appears at a fixed size even when the window is huge", async () => {
    // 250k tokens is 25% of a 1M window, well under the old 60% trigger
    const { container } = await setup(sonnet, 250_000, 0.25);
    expect(container.querySelector("div > div")).not.toBeNull();
  });

  it("still appears at 60% of the window", async () => {
    const { container } = await setup(sonnet, 30_000, 0.7);
    expect(container.querySelector("div > div")).not.toBeNull();
  });

  it("uses an earlier size for a model with a long-context price tier", async () => {
    const { container } = await setup(haiku55, 85_000, 0.1);
    expect(container.querySelector("div > div")).not.toBeNull();
  });
});

describe("ContextStatus tooltip text", () => {
  it("says what one more message costs warm and cold", async () => {
    const { container, user } = await setup(sonnet, 250_000, 0.25);
    await user.hover(container.querySelector("[data-tooltip-id]")!);
    const note = await screen.findByTestId("context-size-note");
    expect(note.textContent).toContain(
      "250k tokens are sent with every message",
    );
    // 250,000 tokens: read $0.30/MTok = $0.07, 5m write $3.75/MTok = $0.94
    expect(note.textContent).toContain("$0.08");
    expect(note.textContent).toContain("$0.94");
  });

  it("warns about the long-context price on Haiku 5.5", async () => {
    const { container, user } = await setup(haiku55, 120_000, 0.12);
    await user.hover(container.querySelector("[data-tooltip-id]")!);
    const note = await screen.findByTestId("long-context-note");
    expect(note.textContent).toContain("5x per token");
  });
});

describe("ContextStatus: compacting a cached conversation", () => {
  const strata = {
    title: "Strata",
    provider: "openai",
    model: "qwen3.8-flash-next-nvfp4-nvfp4",
    apiBase: "http://127.0.0.1:8083/v1/",
    underlyingProviderName: "openai",
  } as any;

  it("warns that compacting drops what a local server has cached", async () => {
    const { container, user } = await setup(strata, 120_000, 0.7);
    await user.hover(container.querySelector("[data-tooltip-id]")!);
    const note = await screen.findByTestId("compaction-cache-note");
    expect(note.textContent).toContain("120k tokens");
    expect(note.textContent).toContain("the model server's cache");
  });

  it("warns for a warm cloud cache too", async () => {
    const { container, user } = await setup(sonnet, 250_000, 0.25);
    await user.hover(container.querySelector("[data-tooltip-id]")!);
    const note = await screen.findByTestId("compaction-cache-note");
    expect(note.textContent).toContain("the prompt cache");
  });

  it("says nothing for a conversation too small to matter", async () => {
    const { container, user } = await setup(strata, 10_000, 0.7);
    await user.hover(container.querySelector("[data-tooltip-id]")!);
    await screen.findByText(/70% of context filled/);
    expect(screen.queryByTestId("compaction-cache-note")).toBeNull();
  });
});
