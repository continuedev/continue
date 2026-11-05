import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { ModelSwitchConfirm } from "./ModelSwitchConfirm";

async function setup(loss = { tokens: 366_000, extraUsd: 1.26 }) {
  const onSwitch = vi.fn();
  const onSwitchInNewSession = vi.fn();
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(
    <ModelSwitchConfirm
      from="Sonnet"
      to="Opus"
      loss={loss}
      onSwitch={onSwitch}
      onSwitchInNewSession={onSwitchInNewSession}
    />,
    { store, mockIdeMessenger: ideMessenger },
  );
  return { ...view, store, onSwitch, onSwitchInNewSession };
}

describe("ModelSwitchConfirm", () => {
  it("names both models, the size and the cost", async () => {
    await setup();
    const text = screen.getByTestId("model-switch-confirm").textContent!;
    expect(text).toContain("Sonnet to Opus");
    expect(text).toContain("366k tokens");
    expect(text).toContain("about $1.26 more");
  });

  it("leaves the cost out for an unpriced model", async () => {
    await setup({ tokens: 150_000 } as any);
    const text = screen.getByTestId("model-switch-confirm").textContent!;
    expect(text).toContain("150k tokens");
    expect(text).not.toContain("$");
  });

  it("switches in this session when confirmed", async () => {
    const { user, onSwitch, onSwitchInNewSession } = await setup();
    await user.click(screen.getByTestId("model-switch-anyway"));
    expect(onSwitch).toHaveBeenCalledOnce();
    expect(onSwitchInNewSession).not.toHaveBeenCalled();
  });

  it("switches in a new session, saving the current one", async () => {
    const { user, store, onSwitch, onSwitchInNewSession } = await setup();
    await act(async () => {
      store.dispatch({
        type: "session/newSession",
        payload: {
          sessionId: "old",
          title: "t",
          workspaceDirectory: "",
          history: [
            { message: { role: "user", content: "hi" }, contextItems: [] },
          ],
        },
      });
    });
    await user.click(screen.getByTestId("model-switch-new-session"));
    await vi.waitFor(() => expect(onSwitchInNewSession).toHaveBeenCalledOnce());
    expect(store.getState().session.id).not.toBe("old");
    expect(store.getState().session.history).toHaveLength(0);
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("changes nothing on cancel", async () => {
    const { user, onSwitch, onSwitchInNewSession } = await setup();
    await user.click(screen.getByTestId("model-switch-cancel"));
    expect(onSwitch).not.toHaveBeenCalled();
    expect(onSwitchInNewSession).not.toHaveBeenCalled();
  });
});
