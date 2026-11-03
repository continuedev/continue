import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MockIdeMessenger } from "../../../../context/MockIdeMessenger";
import {
  EMPTY_CONFIG,
  setConfigResult,
} from "../../../../redux/slices/configSlice";
import { setupStore } from "../../../../redux/store";
import { renderWithProviders } from "../../../../util/test/render";
import { BlockSettingsTopToolbar } from "./BlockSettingsTopToolbar";

const secretError = {
  fatal: false,
  message: "AK is not set",
  action: {
    kind: "setSecret" as const,
    secretName: "AK",
    providers: ["anthropic"],
    modelNames: ["Claude"],
  },
};

async function setup(errors: any[] | undefined) {
  const ideMessenger = new MockIdeMessenger();
  const post = vi.spyOn(ideMessenger, "post");
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<BlockSettingsTopToolbar />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(
      setConfigResult({
        config: EMPTY_CONFIG,
        errors,
        configLoadInterrupted: false,
      }),
    );
  });
  return { ...view, post, store };
}

describe("toolbar warning for a key that is not set on this machine", () => {
  it("shows nothing when there are no errors", async () => {
    await setup(undefined);
    expect(
      screen.queryByTestId("block-settings-toolbar-icon-error"),
    ).toBeNull();
  });

  it("opens a panel naming the secret, instead of leaving the chat", async () => {
    const { user } = await setup([secretError]);
    await user.click(screen.getByTestId("block-settings-toolbar-icon-error"));
    expect(await screen.findByTestId("missing-secrets-panel")).toBeTruthy();
    expect(screen.getByTestId("missing-secret-AK").textContent).toContain("AK");
    expect(screen.getByTestId("missing-secret-AK").textContent).toContain(
      "Anthropic",
    );
  });

  it("asks core to open the .env file for that secret", async () => {
    const { user, post } = await setup([secretError]);
    await user.click(screen.getByTestId("block-settings-toolbar-icon-error"));
    await user.click(await screen.findByTestId("open-env-AK"));
    expect(post).toHaveBeenCalledWith("config/openSecretLocation", {
      secretName: "AK",
      target: "env",
    });
  });

  it("asks core to open the config line for that secret", async () => {
    const { user, post } = await setup([secretError]);
    await user.click(screen.getByTestId("block-settings-toolbar-icon-error"));
    await user.click(await screen.findByTestId("open-config-line-AK"));
    expect(post).toHaveBeenCalledWith("config/openSecretLocation", {
      secretName: "AK",
      target: "configLine",
    });
  });

  it("keeps the old behaviour (no panel) for any other error", async () => {
    const { user } = await setup([{ fatal: false, message: "something else" }]);
    await user.click(screen.getByTestId("block-settings-toolbar-icon-error"));
    expect(screen.queryByTestId("missing-secrets-panel")).toBeNull();
  });

  it("keeps the old behaviour when another error is present too", async () => {
    const { user } = await setup([
      secretError,
      { fatal: false, message: "something else" },
    ]);
    await user.click(screen.getByTestId("block-settings-toolbar-icon-error"));
    expect(screen.queryByTestId("missing-secrets-panel")).toBeNull();
  });
});
