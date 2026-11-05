import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../../../context/MockIdeMessenger";
import {
  EMPTY_CONFIG,
  updateConfig,
} from "../../../../redux/slices/configSlice";
import { newSession } from "../../../../redux/slices/sessionSlice";
import { setupStore } from "../../../../redux/store";
import { findToolCallById } from "../../../../redux/util";
import { renderWithProviders } from "../../../../util/test/render";
import { AlwaysAllowButton } from "./AlwaysAllowButton";

type Suggest =
  { ok: true; rule: string; summary: string } | { ok: false; reason: string };

const good: Suggest = {
  ok: true,
  rule: "runTerminalCommand(npm test)",
  summary: "this exact command",
};

const CALL = {
  toolCallId: "tc1",
  toolCall: {
    id: "tc1",
    type: "function",
    function: {
      name: "run_terminal_command",
      arguments: '{"command":"npm test"}',
    },
  },
  parsedArgs: { command: "npm test" },
  status: "generated",
} as any;

interface Options {
  suggest: Suggest | "throw" | (() => Promise<Suggest>);
  save?: { result: string } | "throw";
}

async function setup(opts: Options) {
  const ideMessenger = new MockIdeMessenger();
  const saved: any[] = [];
  ideMessenger.responseHandlers["tools/suggestAllowRule"] = async () => {
    if (opts.suggest === "throw") throw new Error("boom");
    return typeof opts.suggest === "function" ? opts.suggest() : opts.suggest;
  };
  ideMessenger.responseHandlers["config/addToolRule"] = async (data) => {
    saved.push(data);
    if (opts.save === "throw") throw new Error("boom");
    return (opts.save ?? { result: "added" }) as any;
  };
  // Running the call goes to core; keep it harmless and instant.
  ideMessenger.responseHandlers["tools/call"] = async () => ({
    contextItems: [],
  });
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(
    <AlwaysAllowButton
      toolCallId="tc1"
      toolName="run_terminal_command"
      parsedArgs={{ command: "npm test" }}
    />,
    { store, mockIdeMessenger: ideMessenger },
  );
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        selectedModelByRole: {
          ...EMPTY_CONFIG.selectedModelByRole,
          chat: { title: "m", model: "m", provider: "mock" } as any,
        },
      }),
    );
    store.dispatch(
      newSession({
        sessionId: "s",
        title: "t",
        workspaceDirectory: "",
        history: [
          {
            message: { role: "assistant", content: "" },
            contextItems: [],
            toolCallStates: [CALL],
          },
        ],
      } as any),
    );
  });
  const status = () =>
    findToolCallById(store.getState().session.history, "tc1")?.status;
  return { ...view, saved, status, store };
}

const button = () => screen.getByTestId("always-allow-button-tc1");
const NOT_RUN = "generated";

describe("AlwaysAllowButton", () => {
  it("saves the suggested rule as an allow rule, then runs the call", async () => {
    const { user, saved, status } = await setup({ suggest: good });
    expect(status()).toBe(NOT_RUN);
    await user.click(button());
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({
      decision: "allow",
      rule: "runTerminalCommand(npm test)",
    });
    await waitFor(() => expect(status()).not.toBe(NOT_RUN));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("runs the call when the rule already exists", async () => {
    const { user, status } = await setup({
      suggest: good,
      save: { result: "exists" },
    });
    await user.click(button());
    await waitFor(() => expect(status()).not.toBe(NOT_RUN));
  });

  it("explains and does NOT run when core cannot make a narrow rule", async () => {
    const { user, saved, status } = await setup({
      suggest: { ok: false, reason: "A command containing * cannot be saved." },
    });
    await user.click(button());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "cannot be saved",
    );
    expect(saved).toHaveLength(0);
    expect(status()).toBe(NOT_RUN);
  });

  it.each([
    ["no editable config", { result: "no-config" }, /local YAML config/],
    ["an invalid rule", { result: "invalid" }, /not valid/],
  ])("says so and does not run for %s", async (_l, save, text) => {
    const { user, status } = await setup({ suggest: good, save });
    await user.click(button());
    expect((await screen.findByRole("alert")).textContent).toMatch(text);
    expect(status()).toBe(NOT_RUN);
  });

  it("does not run when asking core for a rule throws, and can retry", async () => {
    const { user, status } = await setup({ suggest: "throw" });
    await user.click(button());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not",
    );
    expect(status()).toBe(NOT_RUN);
    expect((button() as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not run when saving throws, and can retry", async () => {
    const { user, status } = await setup({ suggest: good, save: "throw" });
    await user.click(button());
    await screen.findByRole("alert");
    expect(status()).toBe(NOT_RUN);
    expect((button() as HTMLButtonElement).disabled).toBe(false);
  });

  it("is disabled while it works, so a double click saves one rule", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { user, saved } = await setup({
      suggest: async () => {
        await gate;
        return good;
      },
    });
    await user.click(button());
    await user.click(button());
    await act(async () => release());
    await waitFor(() => expect(saved).toHaveLength(1));
  });
});
