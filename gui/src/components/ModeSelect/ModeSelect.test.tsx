import { act, screen } from "@testing-library/react";
import { createLoop, formatLoopStatus, stopLoop } from "core/util/loopMode";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { updateConfig, EMPTY_CONFIG } from "../../redux/slices/configSlice";
import {
  setLoop,
  setLoopRequested,
  setMode,
} from "../../redux/slices/sessionSlice";
import { setModeModelOverride } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { ModeSelect } from "./ModeSelect";

async function setup(withModeModels: boolean) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<ModeSelect />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  // Set the config after render: the app's listeners load config on mount.
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        ...(withModeModels
          ? {
              modeModels: {
                plan: {
                  title: "Claude Opus",
                  reasoningEffort: "medium" as const,
                },
                agent: {
                  title: "Claude Sonnet",
                  reasoningEffort: "low" as const,
                },
              },
            }
          : {}),
      }),
    );
  });
  await view.user.click(screen.getByTestId("mode-select-button"));
  return view;
}

describe("ModeSelect model hints", () => {
  it("shows the model and reasoning effort each mode uses", async () => {
    await setup(true);
    expect(screen.getByTestId("mode-model-plan").textContent).toBe(
      "Claude Opus · medium",
    );
    expect(screen.getByTestId("mode-model-agent").textContent).toBe(
      "Claude Sonnet · low",
    );
    expect(screen.queryByTestId("mode-model-chat")).toBeNull();
  });

  it("shows nothing when no modeModels are configured", async () => {
    await setup(false);
    expect(screen.queryByTestId("mode-model-plan")).toBeNull();
  });

  it("reflects a manual pick for a mode", async () => {
    const { store } = await setup(true);
    store.dispatch(
      setModeModelOverride({ mode: "plan", title: "Claude Haiku" }),
    );
    expect((await screen.findByTestId("mode-model-plan")).textContent).toBe(
      "Claude Haiku · medium",
    );
  });
});

describe("ModeSelect Loop entry", () => {
  const plan = {
    updatedAt: new Date().toISOString(),
    items: [
      { id: "1", text: "Write the lexer", status: "pending" as const },
      { id: "2", text: "Add tests", status: "pending" as const },
    ],
  };
  const runningLoop = (withItem: boolean) => ({
    ...createLoop(plan, { now: new Date(), sessionTokens: 0 }),
    ...(withItem && {
      current: {
        kind: "item" as const,
        itemId: "1",
        historyIndex: 0,
        startedAt: new Date().toISOString(),
      },
    }),
  });
  const buttonText = () =>
    screen.getByTestId("mode-select-button").textContent ?? "";

  it("lists Loop after Agent", async () => {
    await setup(false);
    const labels = screen
      .getAllByRole("option")
      .map((o) => (o.textContent ?? "").match(/^(Chat|Plan|Agent|Loop)/)?.[0]);
    expect(labels).toEqual(["Chat", "Plan", "Agent", "Loop"]);
  });

  it("choosing Loop sets Plan mode and the session's loop request", async () => {
    const { store, user } = await setup(false);
    await user.click(screen.getByTestId("mode-option-loop"));
    const session = store.getState().session;
    expect(session.mode).toBe("plan");
    expect(session.loopRequested).toBe(true);
    expect(buttonText()).toContain("Loop");
  });

  it("shows Loop and its status while a loop runs, whatever the mode", async () => {
    const { store } = await setup(false);
    await act(async () => {
      store.dispatch(setMode("agent"));
      store.dispatch(setLoop(runningLoop(true)));
    });
    expect(buttonText()).toContain("Loop");
    expect(screen.getByTestId("mode-select").getAttribute("title")).toBe(
      formatLoopStatus(store.getState().session.loop!),
    );
    // The open menu shows the status under the Loop entry
    expect(
      (await screen.findByTestId("mode-loop-status")).textContent,
    ).toContain("0/2 done");
  });

  it("leaving Loop during an item stops after it, and switches when it stops", async () => {
    const { store, user } = await setup(false);
    await act(async () => {
      store.dispatch(setLoopRequested(true));
      store.dispatch(setMode("agent"));
      store.dispatch(setLoop(runningLoop(true)));
    });
    await user.click(screen.getByText("Chat"));
    let session = store.getState().session;
    expect(session.loopRequested).toBeUndefined();
    expect(session.loop?.stopRequested).toBe(true);
    // The item finishes in its own mode; the picker shows the choice
    expect(session.mode).toBe("agent");
    expect(buttonText()).toContain("Chat");
    await act(async () => {
      store.dispatch(
        setLoop(stopLoop(store.getState().session.loop!, "stopped", "x")),
      );
    });
    session = store.getState().session;
    expect(session.mode).toBe("chat");
    expect(session.modeAfterLoop).toBeUndefined();
  });

  it("leaving Loop between items stops the loop and switches at once", async () => {
    const { store, user } = await setup(false);
    await act(async () => {
      store.dispatch(setLoopRequested(true));
      store.dispatch(setMode("chat"));
      store.dispatch(setLoop(runningLoop(false)));
    });
    await user.click(screen.getByText("Agent"));
    const session = store.getState().session;
    expect(session.loop?.status).toBe("stopped");
    expect(session.mode).toBe("agent");
    expect(buttonText()).toContain("Agent");
  });
});
