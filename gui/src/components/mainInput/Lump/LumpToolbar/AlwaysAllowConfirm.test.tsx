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

const RULE = "runTerminalCommand(npm install left-pad)";

const CALL = {
  toolCallId: "tc1",
  toolCall: {
    id: "tc1",
    type: "function",
    function: { name: "run_terminal_command", arguments: "{}" },
  },
  parsedArgs: { command: "npm install left-pad" },
  status: "generated",
} as any;

async function setup(loosensCheck: boolean | undefined) {
  const ideMessenger = new MockIdeMessenger();
  const saved: any[] = [];
  let suggestCalls = 0;
  ideMessenger.responseHandlers["tools/suggestAllowRule"] = async () => {
    suggestCalls++;
    return {
      ok: true,
      rule: RULE,
      summary: "this exact command",
      loosensCheck,
    };
  };
  ideMessenger.responseHandlers["config/addToolRule"] = async (data) => {
    saved.push(data);
    return { result: "added" };
  };
  ideMessenger.responseHandlers["tools/call"] = async () => ({
    contextItems: [],
  });
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(
    <AlwaysAllowButton
      toolCallId="tc1"
      toolName="run_terminal_command"
      parsedArgs={{ command: "npm install left-pad" }}
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
  return { ...view, saved, status, suggestCalls: () => suggestCalls };
}

const button = () => screen.getByTestId("always-allow-button-tc1");

describe("AlwaysAllowButton: confirming a rule that turns a safety check off", () => {
  it("first click shows the exact rule and saves nothing", async () => {
    const { user, saved, status } = await setup(true);
    await user.click(button());
    expect(
      (await screen.findByTestId("always-allow-confirm-tc1")).textContent,
    ).toBe(RULE);
    expect(button().textContent).toBe("Confirm always allow");
    expect(saved).toHaveLength(0);
    expect(status()).toBe("generated");
  });

  it("second click saves that rule, then runs the call", async () => {
    const { user, saved, status } = await setup(true);
    await user.click(button());
    await screen.findByTestId("always-allow-confirm-tc1");
    await user.click(button());
    await waitFor(() =>
      expect(saved).toEqual([{ decision: "allow", rule: RULE }]),
    );
    await waitFor(() => expect(status()).not.toBe("generated"));
  });

  it("asks core only once; the second click does not ask again", async () => {
    const { user, suggestCalls } = await setup(true);
    await user.click(button());
    await screen.findByTestId("always-allow-confirm-tc1");
    await user.click(button());
    await waitFor(() => expect(suggestCalls()).toBe(1));
  });

  it("Not now backs out: nothing saved, nothing run, button back to normal", async () => {
    const { user, saved, status } = await setup(true);
    await user.click(button());
    await user.click(await screen.findByTestId("always-allow-cancel-tc1"));
    expect(screen.queryByTestId("always-allow-confirm-tc1")).toBeNull();
    expect(button().textContent).toBe("Always allow");
    expect(saved).toHaveLength(0);
    expect(status()).toBe("generated");
  });

  it("after backing out, it can start over and still needs the second click", async () => {
    const { user, saved } = await setup(true);
    await user.click(button());
    await user.click(await screen.findByTestId("always-allow-cancel-tc1"));
    await user.click(button());
    await screen.findByTestId("always-allow-confirm-tc1");
    expect(saved).toHaveLength(0);
  });
});

describe("AlwaysAllowButton: no confirmation when nothing is being switched off", () => {
  it.each([false, undefined])(
    "loosensCheck=%s saves on the first click",
    async (flag) => {
      const { user, saved, status } = await setup(flag);
      await user.click(button());
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(screen.queryByTestId("always-allow-confirm-tc1")).toBeNull();
      await waitFor(() => expect(status()).not.toBe("generated"));
    },
  );
});
