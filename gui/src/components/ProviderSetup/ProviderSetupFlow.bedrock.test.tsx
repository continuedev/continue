import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { renderWithProviders } from "../../util/test/render";
import { ProviderSetupFlow } from "./ProviderSetupFlow";

// Carries over the Bedrock coverage of the removed AddModelForm test.
describe("ProviderSetupFlow - Amazon Bedrock", () => {
  it("switches fields with the auth method, discovers models and saves the pick", async () => {
    const messenger = new MockIdeMessenger();
    const saves: any[] = [];
    messenger.responseHandlers["config/getProviderSetup"] = async () => ({
      connections: [],
      secureStorageAvailable: true,
      preferredKeyStorage: "secure",
      editable: true,
    });
    messenger.responseHandlers["config/saveProviderModels"] = async (req) => {
      saves.push(req);
      return { saved: true };
    };
    messenger.responseHandlers["bedrock/listModels"] = async () => ({
      ok: true,
      models: [
        {
          id: "amazon.nova-pro-v1:0",
          name: "Nova Pro",
          provider: "Amazon",
          kind: "on-demand",
        },
      ],
    });

    const { user } = await renderWithProviders(
      <ProviderSetupFlow initialProvider="bedrock" onDone={vi.fn()} />,
      { mockIdeMessenger: messenger },
    );

    // Default flow: API key
    const next = screen.getByRole("button", { name: "Next" });
    expect(screen.getByLabelText("Bedrock API key")).toBeTruthy();
    expect(screen.queryByLabelText("AWS profile name")).toBeNull();
    expect((next as HTMLButtonElement).disabled).toBe(true);

    // Switch to profile / SSO
    await user.selectOptions(
      screen.getByLabelText("Authentication"),
      "profile",
    );
    expect(screen.queryByLabelText("Bedrock API key")).toBeNull();
    await user.type(screen.getByLabelText("AWS profile name"), "work");
    await user.selectOptions(screen.getByLabelText("AWS region"), "eu-west-1");
    await waitFor(() =>
      expect((next as HTMLButtonElement).disabled).toBe(false),
    );

    // Discover models: the checklist is repopulated from the live list
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    expect(
      await screen.findByText(/1 model available in eu-west-1/),
    ).toBeTruthy();

    await user.click(next);
    // The live list's model is selected, not the presets it replaced
    const nova = (await screen.findByLabelText(/Nova Pro/)) as HTMLInputElement;
    await waitFor(() => expect(nova.checked).toBe(true));
    expect(screen.getByTestId("model-checklist").textContent).toContain(
      "1 model selected",
    );
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].provider).toBe("bedrock");
    expect(saves[0].connection).toEqual({
      region: "eu-west-1",
      profile: "work",
    });
    expect(saves[0].add).toHaveLength(1);
    expect(saves[0].add[0]).toMatchObject({
      provider: "bedrock",
      model: "amazon.nova-pro-v1:0",
      title: "Amazon Nova Pro (Bedrock)",
      profile: "work",
      region: "eu-west-1",
    });
    // No key is sent for profile auth.
    expect(saves[0].add[0]).not.toHaveProperty("apiKey");
  });
});
