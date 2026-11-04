import { screen, waitFor } from "@testing-library/react";
import type { ProviderSetupInfo } from "core/config/providerSetup";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { renderWithProviders } from "../../../util/test/render";
import { ProvidersCard } from "./ProvidersCard";

function setupWith(
  storedIn: { secure: boolean; env: boolean } | undefined,
  secureStorageAvailable = true,
): ProviderSetupInfo {
  return {
    connections: [
      {
        provider: "anthropic",
        connection: {},
        models: [{ name: "Opus", model: "claude-opus" }],
        key: {
          state: "secret",
          secretName: "CONTINUED_ANTHROPIC_API_KEY",
          storedIn,
        },
      },
    ],
    secureStorageAvailable,
    preferredKeyStorage: "env",
    editable: true,
  };
}

function messengerWith(setup: ProviderSetupInfo) {
  const m = new MockIdeMessenger();
  const calls: { type: string; data: any }[] = [];
  m.responseHandlers["config/getProviderSetup"] = async () => setup;
  m.responseHandlers["config/moveKeyToSecureStorage"] = async (req) => {
    calls.push({ type: "move", data: req });
    return { moved: true, envRemoved: true };
  };
  m.responseHandlers["config/removeEnvSecret"] = async (req) => {
    calls.push({ type: "remove", data: req });
    return { removed: true };
  };
  return { m, calls };
}

describe("ProvidersCard key storage actions", () => {
  it("moves a key that is only in ~/.continue/.env after confirmation", async () => {
    const { m, calls } = messengerWith(setupWith({ secure: false, env: true }));
    const { user } = await renderWithProviders(<ProvidersCard />, {
      mockIdeMessenger: m,
    });

    await user.click(
      await screen.findByRole("button", { name: "Move key to secure storage" }),
    );
    // Asks first; nothing is sent yet.
    expect(screen.getByTestId("key-action-confirm").textContent).toMatch(
      /config\.yaml stays the same/,
    );
    expect(calls).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      type: "move",
      data: { secretName: "CONTINUED_ANTHROPIC_API_KEY" },
    });
  });

  it("does nothing when the user cancels", async () => {
    const { m, calls } = messengerWith(setupWith({ secure: false, env: true }));
    const { user } = await renderWithProviders(<ProvidersCard />, {
      mockIdeMessenger: m,
    });
    await user.click(
      await screen.findByRole("button", { name: "Move key to secure storage" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("key-action-confirm")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("offers to delete the .env copy when the key is in both places", async () => {
    const { m, calls } = messengerWith(setupWith({ secure: true, env: true }));
    const { user } = await renderWithProviders(<ProvidersCard />, {
      mockIdeMessenger: m,
    });
    expect(
      screen.queryByRole("button", { name: "Move key to secure storage" }),
    ).toBeNull();
    await user.click(
      await screen.findByRole("button", { name: "Remove .env copy" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete line" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].type).toBe("remove");
  });

  it("shows no action when the key is not in .env or secure storage is unavailable", async () => {
    for (const setup of [
      setupWith({ secure: true, env: false }),
      setupWith({ secure: false, env: false }),
      setupWith({ secure: false, env: true }, false),
      setupWith(undefined),
    ]) {
      const { m } = messengerWith(setup);
      const { unmount } = await renderWithProviders(<ProvidersCard />, {
        mockIdeMessenger: m,
      });
      await screen.findByTestId("provider-row-anthropic");
      expect(
        screen.queryByRole("button", { name: /Move key|Remove \.env/ }),
      ).toBeNull();
      unmount();
    }
  });

  it("shows the error from core and no key value", async () => {
    const { m } = messengerWith(setupWith({ secure: false, env: true }));
    m.responseHandlers["config/moveKeyToSecureStorage"] = async () => ({
      moved: false,
      error: "This editor did not keep the key in secure storage",
    });
    const { user } = await renderWithProviders(<ProvidersCard />, {
      mockIdeMessenger: m,
    });
    await user.click(
      await screen.findByRole("button", { name: "Move key to secure storage" }),
    );
    await user.click(screen.getByRole("button", { name: "Move" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /did not keep the key/,
    );
  });
});
