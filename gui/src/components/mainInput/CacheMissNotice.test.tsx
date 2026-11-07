import { describe, expect, it } from "vitest";
import { CacheMissNotice } from "./CacheMissNotice";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  act,
  screen,
  setPromptCacheState,
  setupNotice,
} from "./noticeTestUtils";

const miss = { readTokens: 0, expectedTokens: 112_000, causes: [] as string[] };
const setup = () => setupNotice(<CacheMissNotice />);

describe("CacheMissNotice", () => {
  it("waits for repeated misses", async () => {
    const { store } = await setup();
    await act(async () => {
      store.dispatch(
        setPromptCacheState({ escalated: false, misses: 2, lastMiss: miss }),
      );
    });
    expect(screen.queryByTestId("cache-miss-notice")).toBeNull();
  });

  it("appears after three and names the sizes", async () => {
    const { store } = await setup();
    await act(async () => {
      store.dispatch(
        setPromptCacheState({ escalated: false, misses: 3, lastMiss: miss }),
      );
    });
    const text = screen.getByTestId("cache-miss-notice").textContent!;
    expect(text).toContain("missed 3 times");
    expect(text).toContain("0 of 112k");
    expect(text).toContain("Nothing the app controls changed");
  });

  it("names what changed when it knows", async () => {
    const { store } = await setup();
    await act(async () => {
      store.dispatch(
        setPromptCacheState({
          escalated: false,
          misses: 3,
          lastMiss: { ...miss, causes: ["the tools changed"] },
        }),
      );
    });
    const text = screen.getByTestId("cache-miss-notice").textContent!;
    expect(text).toContain("Likely cause: the tools changed.");
    expect(text).not.toContain("Nothing the app controls changed");
  });

  it("lists several causes", async () => {
    const { store } = await setup();
    await act(async () => {
      store.dispatch(
        setPromptCacheState({
          escalated: false,
          misses: 3,
          lastMiss: {
            ...miss,
            causes: [
              "the tools changed",
              "the oldest messages were dropped to fit",
            ],
          },
        }),
      );
    });
    expect(screen.getByTestId("cache-miss-notice").textContent).toContain(
      "the tools changed; the oldest messages were dropped to fit.",
    );
  });

  it("goes away when dismissed and returns only after three more", async () => {
    const { store, user } = await setup();
    await act(async () => {
      store.dispatch(
        setPromptCacheState({ escalated: false, misses: 3, lastMiss: miss }),
      );
    });
    await user.click(screen.getByTestId("cache-miss-notice-dismiss"));
    expect(screen.queryByTestId("cache-miss-notice")).toBeNull();

    const withMisses = (misses: number) =>
      setPromptCacheState({
        ...store.getState().session.promptCache!,
        misses,
      });
    await act(async () => {
      store.dispatch(withMisses(5));
    });
    expect(screen.queryByTestId("cache-miss-notice")).toBeNull();
    await act(async () => {
      store.dispatch(withMisses(6));
    });
    expect(screen.getByTestId("cache-miss-notice")).toBeInTheDocument();
  });
});

describe("CacheMissNotice on a local server", () => {
  const strata = {
    title: "Strata",
    provider: "openai",
    model: "qwen3.8-flash-next-nvfp4-nvfp4",
    apiBase: "http://127.0.0.1:8083/v1/",
    underlyingProviderName: "openai",
  };

  async function setupLocal(misses: number, causes: string[] = []) {
    const { store } = await setup();
    await act(async () => {
      store.dispatch(
        updateConfig({
          ...EMPTY_CONFIG,
          selectedModelByRole: {
            ...EMPTY_CONFIG.selectedModelByRole,
            chat: strata,
          },
          modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [strata] },
        } as any),
      );
      store.dispatch(
        setPromptCacheState({
          escalated: false,
          misses,
          lastMiss: { ...miss, causes },
        }),
      );
    });
  }

  it("appears after one miss, since each one costs minutes", async () => {
    await setupLocal(1);
    const text = screen.getByTestId("cache-miss-notice").textContent!;
    expect(text).toContain("missed once");
    // Nothing changed on this side: the usual local reasons
    expect(text).toContain("unloaded the model");
    expect(text).toContain("another conversation");
  });

  it("still names what changed when it knows", async () => {
    await setupLocal(1, ["the system prompt changed"]);
    const text = screen.getByTestId("cache-miss-notice").textContent!;
    expect(text).toContain("Likely cause: the system prompt changed.");
  });
});
