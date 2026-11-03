import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import ModelSelect from "./ModelSelect";

const model = (title: string, configurationStatus: string) =>
  ({
    title,
    model: title,
    provider: "anthropic",
    underlyingProvider: "anthropic",
    underlyingProviderName: "anthropic",
    configurationStatus,
  }) as any;

async function setup(status: string) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<ModelSelect />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  const claude = model("Claude", status);
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: [claude] },
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: claude,
        },
      }),
    );
  });
  await view.user.click(screen.getByTestId("model-select-button"));
  return view;
}

describe("model picker when the selected model's key is not set", () => {
  it("puts a warning dot on the gear", async () => {
    await setup("missing-env-secret");
    expect(screen.getByTestId("model-select-key-not-set-dot")).toBeTruthy();
    expect(screen.getByTestId("model-option-key-not-set")).toBeTruthy();
  });

  it("shows no dot when the model is fine", async () => {
    await setup("valid");
    expect(screen.queryByTestId("model-select-key-not-set-dot")).toBeNull();
    expect(screen.queryByTestId("model-option-key-not-set")).toBeNull();
  });
});
