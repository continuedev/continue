import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import { setPromptCacheState } from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import {
  estimateEditorTokens,
  LargeMessageNoticeView,
} from "./LargeMessageNotice";

const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
} as any;

const doc = (...paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  })),
});

describe("estimateEditorTokens", () => {
  it("counts about four characters to a token", () => {
    expect(estimateEditorTokens(doc("a".repeat(4_000)))).toBe(1_000);
  });

  it("adds the paragraphs of a draft", () => {
    expect(
      estimateEditorTokens(doc("a".repeat(400), "b".repeat(800))),
    ).toBeGreaterThanOrEqual(300);
  });

  it("counts an image as a fixed amount", () => {
    const withImage = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "data:image/png;base64,AAAA" } },
      ],
    };
    expect(estimateEditorTokens(withImage)).toBe(1_500);
  });

  it("is zero for an empty draft", () => {
    expect(estimateEditorTokens({ type: "doc", content: [] })).toBe(0);
    expect(estimateEditorTokens({ type: "doc" })).toBe(0);
  });
});

async function setup(tokens: number, setting: "5m" | "off" = "5m") {
  const onDismiss = vi.fn();
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(
    <LargeMessageNoticeView tokens={tokens} onDismiss={onDismiss} />,
    { store, mockIdeMessenger: ideMessenger },
  );
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
      setPromptCacheSetting({ modelTitle: claude.title, setting }),
    );
    store.dispatch(setPromptCacheState({ escalated: false }));
  });
  return { ...view, onDismiss };
}

describe("LargeMessageNoticeView", () => {
  it("says what the message costs to write and to re-read", async () => {
    await setup(200_000);
    const text = screen.getByTestId("large-message-notice").textContent!;
    expect(text).toContain("about 200k tokens");
    // 200,000 tokens on Sonnet 4.6: 5m write $3.75/MTok = $0.75, read $0.30/MTok = $0.06
    expect(text).toContain("$0.75");
    expect(text).toContain("$0.06");
    expect(text).toContain("starting a new session");
  });

  it("gives only the size when caching is off", async () => {
    await setup(200_000, "off");
    const text = screen.getByTestId("large-message-notice").textContent!;
    expect(text).toContain("about 200k tokens");
    expect(text).not.toContain("$");
  });

  it("can be dismissed", async () => {
    const { user, onDismiss } = await setup(200_000);
    await user.click(screen.getByTestId("large-message-notice-dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
