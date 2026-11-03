import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
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
});
