import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import {
  setActive,
  setInactive,
  setPromptCacheState,
} from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { PromptCacheButton } from "./PromptCacheButton";

const claude = {
  title: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};
const bedrockOld = {
  title: "Old Bedrock",
  provider: "bedrock",
  model: "anthropic.claude-3-7-sonnet-20250219-v1:0",
  underlyingProviderName: "bedrock",
};
const gpt = {
  title: "GPT",
  provider: "openai",
  model: "gpt-4o",
  underlyingProviderName: "openai",
};

async function setup(model: typeof claude | typeof gpt | typeof bedrockOld) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<PromptCacheButton />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  // Set the config after render: the app's listeners load config on mount.
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: model,
        },
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [model] },
      } as any),
    );
  });
  return { ...view, store };
}

describe("PromptCacheButton", () => {
  it("is not shown for models that do not take the setting", async () => {
    await setup(gpt);
    expect(screen.queryByTestId("prompt-cache-button")).toBeNull();
  });

  it("is shown for Claude on Anthropic", async () => {
    await setup(claude);
    expect(screen.getByTestId("prompt-cache-button")).toBeInTheDocument();
  });

  it("offers Auto, 5 minutes, 1 hour, Off and the config default", async () => {
    const { user } = await setup(claude);
    await user.click(screen.getByTestId("prompt-cache-button"));
    for (const id of ["auto", "5m", "1h", "off", "config"]) {
      expect(
        screen.getByTestId(`prompt-cache-option-${id}`),
      ).toBeInTheDocument();
    }
  });

  it("hides 1 hour for a Bedrock model that cannot take it", async () => {
    const { user } = await setup(bedrockOld);
    await user.click(screen.getByTestId("prompt-cache-button"));
    expect(screen.queryByTestId("prompt-cache-option-1h")).toBeNull();
    expect(screen.getByTestId("prompt-cache-option-auto")).toBeInTheDocument();
  });

  it("stores the choice for the model", async () => {
    const { user, store } = await setup(claude);
    await user.click(screen.getByTestId("prompt-cache-button"));
    await user.click(screen.getByTestId("prompt-cache-option-1h"));
    expect(store.getState().ui.promptCacheSettings["Claude Sonnet"]).toBe("1h");
  });

  it("goes back to the config default", async () => {
    const { user, store } = await setup(claude);
    await act(async () => {
      store.dispatch(
        setPromptCacheSetting({ modelTitle: "Claude Sonnet", setting: "off" }),
      );
    });
    await user.click(screen.getByTestId("prompt-cache-button"));
    await user.click(screen.getByTestId("prompt-cache-option-config"));
    expect(
      store.getState().ui.promptCacheSettings["Claude Sonnet"],
    ).toBeUndefined();
  });

  describe("countdown", () => {
    const T0 = new Date("2026-11-03T12:00:00Z").getTime();

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(T0);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    async function warmSetup(ttl: "5m" | "1h", agoMs: number) {
      const view = await setup(claude);
      await act(async () => {
        view.store.dispatch(
          setPromptCacheSetting({
            modelTitle: "Claude Sonnet",
            setting: "auto",
          }),
        );
        view.store.dispatch(
          setPromptCacheState({
            escalated: ttl === "1h",
            lastRequestAt: T0 - agoMs,
            lastTtl: ttl,
          }),
        );
      });
      return view;
    }

    it("shows a full ring and the time left while warm", async () => {
      await warmSetup("5m", 60_000);
      expect(screen.getByTestId("prompt-cache-ring")).toBeInTheDocument();
      expect(screen.getByTestId("prompt-cache-countdown")).toHaveTextContent(
        "4:00",
      );
    });

    it("counts down as time passes", async () => {
      await warmSetup("5m", 60_000);
      for (let i = 0; i < 30; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(screen.getByTestId("prompt-cache-countdown")).toHaveTextContent(
        "3:30",
      );
    });

    it("shows minutes for a one-hour entry", async () => {
      await warmSetup("1h", 18 * 60_000);
      expect(screen.getByTestId("prompt-cache-countdown")).toHaveTextContent(
        "42m",
      );
    });

    it("turns to the warning color in the last minute", async () => {
      await warmSetup("5m", 4 * 60_000 + 20_000);
      expect(screen.getByTestId("prompt-cache-countdown").className).toContain(
        "text-warning",
      );
    });

    it("falls back to the plain icon once the entry expires", async () => {
      await warmSetup("5m", 4 * 60_000 + 58_000);
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(screen.queryByTestId("prompt-cache-ring")).toBeNull();
      expect(screen.queryByTestId("prompt-cache-countdown")).toBeNull();
      expect(screen.getByTestId("prompt-cache-button")).toBeInTheDocument();
    });

    it("shows no ring when caching is off", async () => {
      const view = await warmSetup("5m", 60_000);
      await act(async () => {
        view.store.dispatch(
          setPromptCacheSetting({
            modelTitle: "Claude Sonnet",
            setting: "off",
          }),
        );
      });
      expect(screen.queryByTestId("prompt-cache-ring")).toBeNull();
    });

    it("shows no ring before the first request", async () => {
      const view = await setup(claude);
      await act(async () => {
        view.store.dispatch(
          setPromptCacheSetting({
            modelTitle: "Claude Sonnet",
            setting: "auto",
          }),
        );
      });
      expect(screen.queryByTestId("prompt-cache-ring")).toBeNull();
    });

    it("keeps a full ring and hides the number while a response streams", async () => {
      const view = await warmSetup("5m", 4 * 60_000 + 50_000);
      await act(async () => {
        view.store.dispatch(setActive());
      });
      expect(screen.getByTestId("prompt-cache-ring")).toBeInTheDocument();
      expect(screen.queryByTestId("prompt-cache-countdown")).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => {
        view.store.dispatch(setInactive());
      });
      expect(screen.getByTestId("prompt-cache-countdown")).toBeInTheDocument();
    });
  });
});
