import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { updateConfig, EMPTY_CONFIG } from "../../redux/slices/configSlice";
import { setModeModelOverride } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { ModeSelect } from "./ModeSelect";

async function setup(withModeModels: boolean) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<ModeSelect />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  // Set the config after render: the app's listeners load config on mount.
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        ...(withModeModels
          ? {
              modeModels: {
                plan: {
                  title: "Claude Opus",
                  reasoningEffort: "medium" as const,
                },
                agent: {
                  title: "Claude Sonnet",
                  reasoningEffort: "low" as const,
                },
              },
            }
          : {}),
      }),
    );
  });
  await view.user.click(screen.getByTestId("mode-select-button"));
  return view;
}

describe("ModeSelect model hints", () => {
  it("shows the model and reasoning effort each mode uses", async () => {
    await setup(true);
    expect(screen.getByTestId("mode-model-plan").textContent).toBe(
      "Claude Opus · medium",
    );
    expect(screen.getByTestId("mode-model-agent").textContent).toBe(
      "Claude Sonnet · low",
    );
    expect(screen.queryByTestId("mode-model-chat")).toBeNull();
  });

  it("shows nothing when no modeModels are configured", async () => {
    await setup(false);
    expect(screen.queryByTestId("mode-model-plan")).toBeNull();
  });

  it("reflects a manual pick for a mode", async () => {
    const { store } = await setup(true);
    store.dispatch(
      setModeModelOverride({ mode: "plan", title: "Claude Haiku" }),
    );
    expect((await screen.findByTestId("mode-model-plan")).textContent).toBe(
      "Claude Haiku · medium",
    );
  });
});
