import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { act, screen } from "./noticeTestUtils";
import { CacheTipsButton } from "./CacheTipsButton";

const regional = {
  title: "Sonnet (Bedrock)",
  provider: "bedrock",
  model: "us.anthropic.claude-sonnet-4-6",
  underlyingProviderName: "bedrock",
};
const global_ = { ...regional, model: "global.anthropic.claude-sonnet-4-6" };
const anthropic = {
  title: "Claude",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};

async function setup(model: any, setting: any = "auto") {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<CacheTipsButton />, {
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
      } as any),
    );
    if (setting !== null) {
      store.dispatch(
        setPromptCacheSetting({ modelTitle: model.title, setting }),
      );
    }
  });
  return { ...view, store };
}

describe("CacheTipsButton", () => {
  it("shows a warning icon for a regional Bedrock model", async () => {
    await setup(regional);
    expect(screen.getByTestId("cache-tips-button")).toBeInTheDocument();
  });

  it("shows nothing for a global model, or another provider", async () => {
    await setup(global_);
    expect(screen.queryByTestId("cache-tips-button")).toBeNull();
  });

  it("shows nothing for an Anthropic model", async () => {
    await setup(anthropic);
    expect(screen.queryByTestId("cache-tips-button")).toBeNull();
  });

  it("opens a panel with the tip and the global ID to try", async () => {
    await setup(regional);
    fireEvent.click(screen.getByTestId("cache-tips-button"));
    expect(
      await screen.findByTestId("cache-tip-regional-premium"),
    ).toHaveTextContent("Regional endpoints cost 10% more");
    expect(
      screen.getByTestId("cache-tip-regional-premium-suggestion"),
    ).toHaveTextContent("global.anthropic.claude-sonnet-4-6");
  });

  it("remembers a dismissal for that model, and the icon goes away", async () => {
    const { store } = await setup(regional);
    fireEvent.click(screen.getByTestId("cache-tips-button"));
    fireEvent.click(
      await screen.findByTestId("cache-tip-regional-premium-dismiss"),
    );
    expect(screen.queryByTestId("cache-tips-button")).toBeNull();
    expect(store.getState().ui.dismissedCacheTips).toEqual({
      "Sonnet (Bedrock)::regional-premium": true,
    });
  });

  it("keeps showing a tip for a different model after one is dismissed", async () => {
    const other = {
      ...regional,
      title: "Other",
      model: "eu.anthropic.claude-opus-5-5",
    };
    const { store } = await setup(regional);
    fireEvent.click(screen.getByTestId("cache-tips-button"));
    fireEvent.click(
      await screen.findByTestId("cache-tip-regional-premium-dismiss"),
    );
    await act(async () => {
      store.dispatch(
        updateConfig({
          ...EMPTY_CONFIG,
          selectedModelByRole: {
            ...EMPTY_CONFIG.selectedModelByRole,
            chat: other,
          },
          modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [other] },
        } as any),
      );
    });
    expect(screen.getByTestId("cache-tips-button")).toBeInTheDocument();
  });
});
