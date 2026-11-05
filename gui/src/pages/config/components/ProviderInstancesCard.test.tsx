import { screen, waitFor } from "@testing-library/react";
import type { ProviderInstancesInfo } from "core/config/providers/types";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { renderWithProviders } from "../../../util/test/render";
import { PlaintextKeysNotice } from "./PlaintextKeysNotice";
import { ProviderInstancesCard } from "./ProviderInstancesCard";

const INFO: ProviderInstancesInfo = {
  instances: [
    {
      name: "anthropic-work",
      provider: "anthropic",
      apiBase: "https://proxy.example.com/v1/",
      source: "global",
      sourceUri: "file:///home/u/.continue/providers.yaml",
      key: {
        state: "secret",
        secretName: "CONTINUED_ANTHROPIC_WORK_API_KEY",
        storedIn: { secure: true, env: false },
      },
      usedBy: [{ config: "Cloud", model: "Sonnet" }],
    },
  ],
  globalFileUri: "file:///home/u/.continue/providers.yaml",
  secureStorageAvailable: true,
};

function messenger() {
  const m = new MockIdeMessenger();
  const calls: { type: string; data: any }[] = [];
  m.responseHandlers["providers/list"] = async () => INFO;
  m.responseHandlers["providers/save"] = async (req) => {
    calls.push({ type: "save", data: req });
    return { saved: true };
  };
  m.responseHandlers["providers/delete"] = async (req) => {
    calls.push({ type: "delete", data: req });
    return { deleted: true };
  };
  m.responseHandlers["config/addConnectedModel"] = async (req) => {
    calls.push({ type: "addModel", data: req });
    return { saved: true };
  };
  return { m, calls };
}

describe("ProviderInstancesCard", () => {
  it("lists instances with where the key is kept, never the key", async () => {
    const { m } = messenger();
    await renderWithProviders(<ProviderInstancesCard />, {
      mockIdeMessenger: m,
    });
    expect(await screen.findByText("anthropic-work")).toBeTruthy();
    expect(screen.getByTestId("provider-instance").textContent).toMatch(
      /key in secure storage.*1 model/,
    );
  });

  it("adds an instance with its key going to secure storage", async () => {
    const { m, calls } = messenger();
    const { user } = await renderWithProviders(<ProviderInstancesCard />, {
      mockIdeMessenger: m,
    });
    await screen.findByText("anthropic-work");
    await user.click(screen.getByTestId("add-provider-instance"));
    await user.type(screen.getByLabelText("Name"), "xai");
    await user.selectOptions(screen.getByLabelText("Provider"), "xAI");
    await user.type(screen.getByLabelText("API key value"), "xai-secret");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      type: "save",
      data: {
        name: "xai",
        provider: "xAI",
        key: { storage: "secure", value: "xai-secret" },
      },
    });
  });

  it("keeps the key when editing without entering a new one", async () => {
    const { m, calls } = messenger();
    const { user } = await renderWithProviders(<ProviderInstancesCard />, {
      mockIdeMessenger: m,
    });
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].data).toEqual({
      previousName: "anthropic-work",
      name: "anthropic-work",
      provider: "anthropic",
      apiBase: "https://proxy.example.com/v1/",
    });
  });

  it("asks before deleting and says which models use the instance", async () => {
    const { m, calls } = messenger();
    const { user } = await renderWithProviders(<ProviderInstancesCard />, {
      mockIdeMessenger: m,
    });
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.getByText(/1 model\(s\) use it/)).toBeTruthy();
    expect(calls).toEqual([]);
    const buttons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(calls).toEqual([
        { type: "delete", data: { name: "anthropic-work" } },
      ]),
    );
  });

  it("adds a model that uses the instance to the selected config", async () => {
    const { m, calls } = messenger();
    const { user } = await renderWithProviders(<ProviderInstancesCard />, {
      mockIdeMessenger: m,
    });
    await user.click(await screen.findByRole("button", { name: "Add model" }));
    await user.type(screen.getByLabelText("Model id"), "claude-opus-4-8");
    await user.click(
      screen.getByRole("button", { name: "Add to the selected config" }),
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      type: "addModel",
      data: {
        connection: "anthropic-work",
        model: "claude-opus-4-8",
        roles: ["chat"],
      },
    });
  });
});

describe("PlaintextKeysNotice", () => {
  it("shows nothing when no key is in plain text", async () => {
    await renderWithProviders(<PlaintextKeysNotice />);
    expect(screen.queryByTestId("plaintext-keys-notice")).toBeNull();
  });

  it("moves the listed keys to secure storage", async () => {
    const m = new MockIdeMessenger();
    const moved: any[] = [];
    let keys = [
      {
        id: "file:///c.yaml#models.0",
        fileUri: "file:///c.yaml",
        fileLabel: "Cloud",
        kind: "model" as const,
        label: "GPT",
        secretName: "CONTINUED_OPENAI_API_KEY",
      },
    ];
    m.responseHandlers["config/findPlaintextKeys"] = async () => ({
      keys,
      secureStorageAvailable: true,
    });
    m.responseHandlers["config/movePlaintextKeys"] = async (req) => {
      moved.push(req);
      keys = [];
      return { moved: req.ids, failed: [] };
    };
    const { user } = await renderWithProviders(<PlaintextKeysNotice />, {
      mockIdeMessenger: m,
    });
    expect(
      (await screen.findByTestId("plaintext-keys-notice")).textContent,
    ).toMatch(/GPT in Cloud/);
    await user.click(
      screen.getByRole("button", { name: "Move to secure storage" }),
    );
    await waitFor(() =>
      expect(moved).toEqual([
        { ids: ["file:///c.yaml#models.0"], storage: "secure" },
      ]),
    );
    expect(await screen.findByRole("status")).toBeTruthy();
  });
});
