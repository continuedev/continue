import { act, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../../redux/slices/configSlice";
import { setupStore } from "../../../redux/store";
import { renderWithProviders } from "../../../util/test/render";
import { AssignModelsCard } from "./AssignModelsCard";
import { ModeModelsTable } from "./ModeModelsTable";

const CATALOG = [
  {
    ref: "Qwen",
    name: "Qwen",
    model: "qwen",
    account: "strata",
    provider: "openai",
  },
  {
    ref: "Qwen#act",
    variant: "act",
    name: "Qwen",
    model: "qwen",
    account: "strata",
    provider: "openai",
  },
  {
    ref: "Claude Sonnet",
    name: "Claude Sonnet",
    model: "us.anthropic.claude-sonnet-4-6",
    account: "bedrock-us",
    provider: "bedrock",
  },
];

async function setup(component: ReactElement, catalog = CATALOG) {
  const ideMessenger = new MockIdeMessenger();
  const saves: any[] = [];
  ideMessenger.responseHandlers["models/catalog"] = async () => catalog;
  ideMessenger.responseHandlers["config/setModelRoles"] = async (data) => {
    saves.push(data);
    return { saved: true };
  };
  ideMessenger.responseHandlers["config/setModeModels"] = async () => ({
    saved: true,
  });
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(component, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        modelsByRole: {
          ...EMPTY_CONFIG.modelsByRole,
          // Qwen#act is in the config for chat; Local is only in the config
          chat: [
            { title: "Qwen#act", provider: "openai", model: "qwen" },
            { title: "Local", provider: "ollama", model: "qwen3" },
          ] as any,
        },
      }),
    );
  });
  return { ...view, store, saves };
}

describe("AssignModelsCard", () => {
  it("lists every catalog model and variant with its account, and the config's own models", async () => {
    await setup(<AssignModelsCard />);
    const table = await screen.findByTestId("assign-models-table");
    expect(table.textContent).toContain("Qwen#act");
    expect(table.textContent).toContain("bedrock-us");
    expect(table.textContent).toContain("Local");
    expect(table.textContent).toContain("(in this config only)");
    const chat = screen.getByLabelText("Chat: Qwen#act") as HTMLInputElement;
    expect(chat.checked).toBe(true);
  });

  it("saves only the rows that changed", async () => {
    const { user, saves } = await setup(<AssignModelsCard />);
    await user.click(await screen.findByLabelText("Subagents: Claude Sonnet"));
    await user.click(screen.getByLabelText("Edit: Qwen#act"));
    await user.click(screen.getByTestId("assign-models-save"));
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].updates).toEqual([
      { ref: "Qwen#act", roles: ["chat", "edit"] },
      { ref: "Claude Sonnet", roles: ["subagent"] },
    ]);
  });

  it("is not shown without a catalog", async () => {
    await setup(<AssignModelsCard />, []);
    expect(screen.queryByTestId("assign-models-table")).toBeNull();
  });
});

describe("ModeModelsTable with a catalog", () => {
  it("offers catalog models the config does not list yet", async () => {
    await setup(<ModeModelsTable />);
    await screen.findByLabelText("Plan: Claude Sonnet");
    // Listed once, not again from the catalog
    expect(screen.getAllByLabelText("Plan: Qwen#act")).toHaveLength(1);
  });
});
