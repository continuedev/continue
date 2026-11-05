import { describe, expect, it } from "vitest";
import { CachingOffNotice } from "./CachingOffNotice";
import {
  act,
  screen,
  setPromptCacheState,
  setupNotice,
} from "./noticeTestUtils";

// Caching is off when the toolbar has no choice, config.yaml does not turn it
// on and the session is in Chat. (In Agent, Plan and Background it is on by
// default; see the last test.)
const setup = () => setupNotice(<CachingOffNotice />, null, "chat");
const big = { escalated: false, lastInputTokens: 200_000 };

describe("CachingOffNotice", () => {
  it("offers caching to a big conversation sent with it off", async () => {
    const { store } = await setup();
    await act(async () => {
      store.dispatch(setPromptCacheState(big));
    });
    const text = screen.getByTestId("caching-off-notice").textContent!;
    expect(text).toContain("Prompt caching is off");
    expect(text).toContain("200k tokens");
    // Sonnet 4.6: $3/MTok input, $0.30/MTok read.
    expect(text).toContain("$0.60");
    expect(text).toContain("$0.06");
  });

  it("stays quiet for a small conversation", async () => {
    const { store } = await setup();
    await act(async () => {
      store.dispatch(
        setPromptCacheState({ escalated: false, lastInputTokens: 20_000 }),
      );
    });
    expect(screen.queryByTestId("caching-off-notice")).toBeNull();
  });

  it("stays quiet before any request has a size", async () => {
    await setup();
    expect(screen.queryByTestId("caching-off-notice")).toBeNull();
  });

  it("respects an explicit Off", async () => {
    const { store } = await setupNotice(<CachingOffNotice />, "off");
    await act(async () => {
      store.dispatch(setPromptCacheState(big));
    });
    expect(screen.queryByTestId("caching-off-notice")).toBeNull();
  });

  it("does not show while caching is on", async () => {
    const { store } = await setupNotice(<CachingOffNotice />, "5m");
    await act(async () => {
      store.dispatch(setPromptCacheState(big));
    });
    expect(screen.queryByTestId("caching-off-notice")).toBeNull();
  });

  it("turns caching on with Auto", async () => {
    const { store, user } = await setup();
    await act(async () => {
      store.dispatch(setPromptCacheState(big));
    });
    await user.click(screen.getByTestId("caching-off-auto"));
    expect(store.getState().ui.promptCacheSettings["Claude Sonnet"]).toBe(
      "auto",
    );
    expect(screen.queryByTestId("caching-off-notice")).toBeNull();
  });

  it("turns caching on for 5 minutes only", async () => {
    const { store, user } = await setup();
    await act(async () => {
      store.dispatch(setPromptCacheState(big));
    });
    await user.click(screen.getByTestId("caching-off-5m"));
    expect(store.getState().ui.promptCacheSettings["Claude Sonnet"]).toBe("5m");
  });

  it("goes away when dismissed and stays away for the session", async () => {
    const { store, user } = await setup();
    await act(async () => {
      store.dispatch(setPromptCacheState(big));
    });
    await user.click(screen.getByTestId("caching-off-notice-dismiss"));
    expect(screen.queryByTestId("caching-off-notice")).toBeNull();
    await act(async () => {
      store.dispatch(
        setPromptCacheState({
          ...store.getState().session.promptCache!,
          lastInputTokens: 300_000,
        }),
      );
    });
    expect(screen.queryByTestId("caching-off-notice")).toBeNull();
  });
});
