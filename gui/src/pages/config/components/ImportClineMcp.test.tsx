import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { renderWithProviders } from "../../../util/test/render";
import { ImportClineMcpButton } from "./ImportClineMcp";

const SOURCE = {
  kind: "cline" as const,
  label: "Cline (Code)",
  path: "/h/cline_mcp_settings.json",
  servers: [
    {
      name: "github",
      transport: "stdio" as const,
      status: "new" as const,
      secretNames: ["GITHUB_TOKEN"],
      allowedToolCount: 2,
    },
    {
      name: "old",
      status: "duplicate" as const,
      secretNames: [],
      allowedToolCount: 0,
    },
  ],
};

describe("ImportClineMcpButton", () => {
  it("is hidden when no settings file is found", async () => {
    const m = new MockIdeMessenger();
    m.responseHandlers["config/previewMcpImport"] = async () => ({
      sources: [],
    });
    await renderWithProviders(<ImportClineMcpButton />, {
      mockIdeMessenger: m,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("import-cline-mcp")).toBeNull();
  });

  it("shows the action when a file is found and sends the chosen servers", async () => {
    const m = new MockIdeMessenger();
    m.responseHandlers["config/previewMcpImport"] = async () => ({
      sources: [SOURCE],
    });
    m.responseHandlers["config/getProviderSetup"] = async () => ({
      connections: [],
      secureStorageAvailable: false,
      preferredKeyStorage: "env",
      editable: true,
    });
    m.responseHandlers["config/importMcpServers"] = async () => ({
      imported: ["github"],
      skipped: [],
      secretsStored: ["GITHUB_TOKEN"],
      secretsPending: [],
      warnings: [],
    });

    const { user, store } = await renderWithProviders(
      <ImportClineMcpButton />,
      {
        mockIdeMessenger: m,
      },
    );
    const button = await screen.findByTestId("import-cline-mcp");
    await user.click(button);
    await waitFor(() => expect(store.getState().ui.showDialog).toBe(true));
    expect(store.getState().ui.dialogMessage).toBeTruthy();
  });
});
