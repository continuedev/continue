import { screen, waitFor } from "@testing-library/react";
import type { ProviderSetupInfo } from "core/config/providerSetup";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { renderWithProviders } from "../../util/test/render";
import { ProviderSetupFlow } from "./ProviderSetupFlow";

const EMPTY_SETUP: ProviderSetupInfo = {
  connections: [],
  secureStorageAvailable: true,
  preferredKeyStorage: "secure",
  editable: true,
};

function messengerWith(setup: ProviderSetupInfo = EMPTY_SETUP) {
  const messenger = new MockIdeMessenger();
  const saves: any[] = [];
  const secrets: any[] = [];
  messenger.responseHandlers["config/getProviderSetup"] = async () => setup;
  messenger.responseHandlers["config/saveProviderModels"] = async (req) => {
    saves.push(req);
    return { saved: true };
  };
  messenger.responseHandlers["config/setSecret"] = async (req) => {
    secrets.push(req);
    return { stored: true };
  };
  return { messenger, saves, secrets };
}

describe("ProviderSetupFlow", () => {
  it("connects a new provider: key, checklist, review, one save", async () => {
    const { messenger, saves } = messengerWith();
    const onDone = vi.fn();
    const { user } = await renderWithProviders(
      <ProviderSetupFlow initialProvider="anthropic" onDone={onDone} />,
      { mockIdeMessenger: messenger },
    );

    const next = screen.getByRole("button", { name: "Next" });
    expect((next as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("API key"), "sk-ant-hunter2");
    await waitFor(() =>
      expect((next as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(next);

    // Popular models start checked; uncheck the first one.
    const boxes = (await screen.findAllByRole(
      "checkbox",
    )) as HTMLInputElement[];
    const checkedBefore = boxes.filter((b) => b.checked);
    expect(checkedBefore.length).toBeGreaterThan(0);
    expect(checkedBefore.length).toBeLessThanOrEqual(3);
    await user.click(checkedBefore[0]);

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByTestId("review-key-plan").textContent).toMatch(
      /CONTINUED_ANTHROPIC_API_KEY/,
    );
    expect(screen.getByTestId("review-key-plan").textContent).not.toContain(
      "hunter2",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(saves).toHaveLength(1);
    expect(saves[0].provider).toBe("anthropic");
    expect(saves[0].add).toHaveLength(checkedBefore.length - 1);
    expect(saves[0].remove).toEqual([]);
    expect(saves[0].key).toEqual({
      storage: "secure",
      secretName: "CONTINUED_ANTHROPIC_API_KEY",
      value: "sk-ant-hunter2",
    });
    // The key is only in `key`, never in a model.
    expect(JSON.stringify(saves[0].add)).not.toContain("hunter2");
  });

  it("falls back to .env when the editor has no secure storage", async () => {
    const { messenger, saves } = messengerWith({
      ...EMPTY_SETUP,
      secureStorageAvailable: false,
      preferredKeyStorage: "env",
    });
    const { user } = await renderWithProviders(
      <ProviderSetupFlow initialProvider="anthropic" onDone={vi.fn()} />,
      { mockIdeMessenger: messenger },
    );
    const select = screen.getByLabelText(
      "Keep the key in",
    ) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).not.toContain("secure");
    expect(select.value).toBe("env");

    await user.type(screen.getByLabelText("API key"), "k");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].key.storage).toBe("env");
  });

  it("blocks an invalid secret name", async () => {
    const { messenger } = messengerWith();
    const { user } = await renderWithProviders(
      <ProviderSetupFlow initialProvider="anthropic" onDone={vi.fn()} />,
      { mockIdeMessenger: messenger },
    );
    await user.type(screen.getByLabelText("API key"), "k");
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "bad name");
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/letters, digits and underscores/)).toBeTruthy();
  });

  it("edits a configured provider: keeps the key, asks before removing", async () => {
    const { messenger, saves } = messengerWith({
      ...EMPTY_SETUP,
      connections: [
        {
          provider: "anthropic",
          connection: {},
          models: [
            { name: "Keep me", model: "claude-keep" },
            { name: "Drop me", model: "claude-drop" },
          ],
          key: { state: "secret", secretName: "ANTHROPIC_API_KEY" },
        },
      ],
    });
    const { user } = await renderWithProviders(
      <ProviderSetupFlow
        initialProvider="anthropic"
        initialConnection={{}}
        onDone={vi.fn()}
      />,
      { mockIdeMessenger: messenger },
    );

    const key = (await screen.findByPlaceholderText(
      "saved - leave blank to keep",
    )) as HTMLInputElement;
    expect(key.value).toBe("");
    await waitFor(() =>
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
        "ANTHROPIC_API_KEY",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Configured models start checked, shown even if the provider list lacks them.
    const keep = (await screen.findByLabelText("Keep me")) as HTMLInputElement;
    const drop = screen.getByLabelText("Drop me") as HTMLInputElement;
    expect(keep.checked && drop.checked).toBe(true);
    await user.click(drop);

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByTestId("review-removals").textContent).toContain(
      "Drop me",
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText("Confirm removal"));
    expect((save as HTMLButtonElement).disabled).toBe(false);
    await user.click(save);

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].remove).toEqual(["Drop me"]);
    expect(saves[0].add).toEqual([]);
    expect(saves[0].key).toBeUndefined();
  });

  it("shows an error from core and does not close", async () => {
    const { messenger } = messengerWith();
    messenger.responseHandlers["config/saveProviderModels"] = async () => ({
      saved: false,
      error: "disk full",
    });
    const onDone = vi.fn();
    const { user } = await renderWithProviders(
      <ProviderSetupFlow initialProvider="anthropic" onDone={onDone} />,
      { mockIdeMessenger: messenger },
    );
    await user.type(screen.getByLabelText("API key"), "k");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("disk full");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("Enter key mode stores only the secret and skips the model steps", async () => {
    const { messenger, saves, secrets } = messengerWith();
    const onDone = vi.fn();
    const { user } = await renderWithProviders(
      <ProviderSetupFlow
        initialProvider="anthropic"
        enterKey={{ secretName: "CONTINUED_ANTHROPIC_API_KEY" }}
        onDone={onDone}
      />,
      { mockIdeMessenger: messenger },
    );
    expect(screen.queryByText(/Step 1 of 3/)).toBeNull();
    const save = screen.getByRole("button", { name: "Save key" });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("API key"), "sk-ant-new");
    await user.click(save);

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(secrets).toEqual([
      {
        secretName: "CONTINUED_ANTHROPIC_API_KEY",
        value: "sk-ant-new",
        storage: "secure",
      },
    ]);
    expect(saves).toEqual([]);
  });

  it("asks before removing a plaintext copy from ~/.continue/.env", async () => {
    const { messenger, secrets } = messengerWith();
    messenger.responseHandlers["config/setSecret"] = async (req) => {
      secrets.push(req);
      return { stored: true, envShadowed: true };
    };
    const removals: any[] = [];
    messenger.responseHandlers["config/removeEnvSecret"] = async (req) => {
      removals.push(req);
      return { removed: true };
    };
    const onDone = vi.fn();
    const { user } = await renderWithProviders(
      <ProviderSetupFlow
        initialProvider="anthropic"
        enterKey={{ secretName: "CONTINUED_ANTHROPIC_API_KEY" }}
        onDone={onDone}
      />,
      { mockIdeMessenger: messenger },
    );
    await user.type(screen.getByLabelText("API key"), "sk-ant-new");
    await user.click(screen.getByRole("button", { name: "Save key" }));

    // Nothing is removed, and the flow stays open, until the user answers.
    expect(await screen.findByTestId("env-copy-prompt")).toBeDefined();
    expect(removals).toEqual([]);
    expect(onDone).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove from .env" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(removals).toEqual([{ secretName: "CONTINUED_ANTHROPIC_API_KEY" }]);
  });

  it("keeps the .env line when the user says so", async () => {
    const { messenger } = messengerWith();
    messenger.responseHandlers["config/saveProviderModels"] = async () => ({
      saved: true,
      envShadowedSecret: "CONTINUED_ANTHROPIC_API_KEY",
    });
    const removals: any[] = [];
    messenger.responseHandlers["config/removeEnvSecret"] = async (req) => {
      removals.push(req);
      return { removed: true };
    };
    const onDone = vi.fn();
    const { user } = await renderWithProviders(
      <ProviderSetupFlow initialProvider="anthropic" onDone={onDone} />,
      { mockIdeMessenger: messenger },
    );
    await user.type(screen.getByLabelText("API key"), "k");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Keep it" }));
    expect(onDone).toHaveBeenCalled();
    expect(removals).toEqual([]);
  });

  it("edits a connection's endpoint in place instead of adding a new connection", async () => {
    const { messenger, saves } = messengerWith({
      ...EMPTY_SETUP,
      connections: [
        {
          provider: "lemonade",
          connection: { apiBase: "http://localhost:8000/api/v1" },
          models: [
            { name: "Mine 1", model: "mine-one" },
            { name: "Mine 2", model: "mine-two" },
          ],
          key: { state: "none" },
        },
      ],
    });
    const { user } = await renderWithProviders(
      <ProviderSetupFlow
        initialProvider="lemonade"
        initialConnection={{ apiBase: "http://localhost:8000/api/v1" }}
        onDone={vi.fn()}
      />,
      { mockIdeMessenger: messenger },
    );

    const apiBase = (await screen.findByLabelText(
      "API Base",
    )) as HTMLInputElement;
    await waitFor(() =>
      expect(apiBase.value).toBe("http://localhost:8000/api/v1"),
    );
    await user.clear(apiBase);
    await user.type(apiBase, "http://gpu-box:8000/api/v1");
    await user.click(screen.getByRole("button", { name: "Next" }));

    // The models of the connection being edited stay checked.
    const one = (await screen.findByLabelText("Mine 1")) as HTMLInputElement;
    const two = screen.getByLabelText("Mine 2") as HTMLInputElement;
    expect(one.checked && two.checked).toBe(true);

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByTestId("review-connection-change").textContent).toMatch(
      /http:\/\/localhost:8000\/api\/v1 becomes http:\/\/gpu-box:8000\/api\/v1.*2 existing models/,
    );
    expect(screen.queryByTestId("review-removals")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].from).toEqual({ apiBase: "http://localhost:8000/api/v1" });
    // A connection set up the old way is edited as it is, not as an account
    expect(saves[0].account).toBeUndefined();
    expect(saves[0].connection).toEqual({
      apiBase: "http://gpu-box:8000/api/v1",
    });
    expect(saves[0].remove).toEqual([]);
    expect(saves[0].add).toEqual([]);
  });

  it("does not send `from` when the endpoint is unchanged", async () => {
    const { messenger, saves } = messengerWith({
      ...EMPTY_SETUP,
      connections: [
        {
          provider: "anthropic",
          connection: {},
          models: [{ name: "Old", model: "claude-old" }],
          key: { state: "secret", secretName: "ANTHROPIC_API_KEY" },
        },
      ],
    });
    const { user } = await renderWithProviders(
      <ProviderSetupFlow
        initialProvider="anthropic"
        initialConnection={{}}
        onDone={vi.fn()}
      />,
      { mockIdeMessenger: messenger },
    );
    await user.click(await screen.findByRole("button", { name: "Next" }));
    const boxes = (await screen.findAllByRole(
      "checkbox",
    )) as HTMLInputElement[];
    const extra = boxes.find((b) => !b.checked)!;
    await user.click(extra);
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.queryByTestId("review-connection-change")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].from).toBeUndefined();
  });
});
