import { render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { ProvidersCard } from "../../pages/config/components/ProvidersCard";
import { renderWithProviders } from "../../util/test/render";
import { MissingSecretsPanel } from "../config/MissingSecretsPanel";
import { OnboardingProvidersTab } from "../OnboardingCard/components/OnboardingProvidersTab";

const SETUP = {
  connections: [
    {
      provider: "anthropic",
      connection: {},
      models: [{ name: "Opus", model: "claude-opus" }],
      key: {
        state: "secret" as const,
        secretName: "CONTINUOUS_ANTHROPIC_API_KEY",
      },
    },
    {
      provider: "openai",
      connection: { apiBase: "http://localhost:1234/v1" },
      models: [
        { name: "A", model: "a" },
        { name: "B", model: "b" },
      ],
      key: { state: "none" as const },
    },
  ],
  secureStorageAvailable: true,
  preferredKeyStorage: "secure" as const,
  editable: true,
};

function messenger() {
  const m = new MockIdeMessenger();
  m.responseHandlers["config/getProviderSetup"] = async () => SETUP;
  return m;
}

describe("Enter key in the missing-secret popover", () => {
  it("opens the setup flow for that secret in the dialog", async () => {
    const onDone = vi.fn();
    const m = messenger();
    const { user, store } = await renderWithProviders(
      <MissingSecretsPanel
        missing={[
          {
            secretName: "CONTINUOUS_ANTHROPIC_API_KEY",
            providers: ["anthropic"],
            modelNames: ["Opus"],
          },
        ]}
        onDone={onDone}
      />,
      { mockIdeMessenger: m },
    );

    await user.click(
      screen.getByTestId("enter-key-CONTINUOUS_ANTHROPIC_API_KEY"),
    );

    expect(onDone).toHaveBeenCalled();
    expect(store.getState().ui.showDialog).toBe(true);
    expect(store.getState().ui.dialogMessage?.props).toMatchObject({
      initialProvider: "anthropic",
      enterKey: { secretName: "CONTINUOUS_ANTHROPIC_API_KEY" },
    });
  });

  it("keeps the other actions", async () => {
    await renderWithProviders(
      <MissingSecretsPanel
        missing={[{ secretName: "K", providers: ["openai"], modelNames: [] }]}
      />,
      { mockIdeMessenger: messenger() },
    );
    expect(screen.getByTestId("open-env-K")).toBeTruthy();
    expect(screen.getByTestId("open-config-line-K")).toBeTruthy();
    expect(screen.getByTestId("copy-name-K")).toBeTruthy();
  });
});

describe("ProvidersCard", () => {
  it("lists connections and opens the flow to edit one", async () => {
    const { user, store } = await renderWithProviders(<ProvidersCard />, {
      mockIdeMessenger: messenger(),
    });
    expect(await screen.findByTestId("provider-row-anthropic")).toBeTruthy();
    expect(screen.getByTestId("provider-row-openai").textContent).toContain(
      "http://localhost:1234/v1 - 2 models",
    );

    await user.click(
      within(screen.getByTestId("provider-row-openai")).getByRole("button", {
        name: "Edit",
      }),
    );
    expect(store.getState().ui.showDialog).toBe(true);
    expect(store.getState().ui.dialogMessage?.props).toMatchObject({
      initialProvider: "openai",
      initialConnection: { apiBase: "http://localhost:1234/v1" },
    });
  });

  it("Add provider opens the flow without a preset", async () => {
    const { user, store } = await renderWithProviders(<ProvidersCard />, {
      mockIdeMessenger: messenger(),
    });
    await user.click(await screen.findByTestId("add-provider"));
    expect(store.getState().ui.showDialog).toBe(true);
    expect(store.getState().ui.dialogMessage?.props.initialProvider).toBe(
      undefined,
    );
  });
});

describe("Dialog content", () => {
  it("Enter key dialog renders the key-only flow", async () => {
    const { user, store } = await renderWithProviders(
      <MissingSecretsPanel
        missing={[
          {
            secretName: "CONTINUOUS_OPENAI_API_KEY",
            providers: ["openai"],
            modelNames: [],
          },
        ]}
      />,
      { mockIdeMessenger: messenger() },
    );
    await user.click(screen.getByTestId("enter-key-CONTINUOUS_OPENAI_API_KEY"));
    const { container } = render(
      <Provider store={store}>{store.getState().ui.dialogMessage}</Provider>,
    );
    const dialog = within(container);
    expect(
      await dialog.findByRole("button", { name: "Save key" }),
    ).toBeTruthy();
    expect(dialog.getByText("CONTINUOUS_OPENAI_API_KEY")).toBeTruthy();
  });
});

describe("Onboarding API key tab", () => {
  it("shows the shared setup flow instead of fixed provider key fields", async () => {
    await renderWithProviders(<OnboardingProvidersTab />, {
      mockIdeMessenger: messenger(),
    });
    expect(screen.getByTestId("provider-setup-flow")).toBeTruthy();
    expect(screen.getByLabelText("API key")).toBeTruthy();
  });

  it("completes onboarding after the review step is saved", async () => {
    const m = messenger();
    m.responseHandlers["config/saveProviderModels"] = async () => ({
      saved: true,
    });
    const post = vi.spyOn(m, "post");
    localStorage.setItem("onboardingStatus", JSON.stringify("Started"));
    const { user } = await renderWithProviders(<OnboardingProvidersTab />, {
      mockIdeMessenger: m,
    });
    await user.type(screen.getByLabelText("API key"), "sk-ant-1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(post.mock.calls.some(([t]) => t === "showTutorial")).toBe(true),
    );
    // The old fixed-list message is no longer used by this tab.
    expect(post.mock.calls.some(([t]) => t === "onboarding/complete")).toBe(
      false,
    );
    expect(localStorage.getItem("onboardingStatus")).toBe('"Completed"');
  });
});
