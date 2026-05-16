import { act, screen } from "@testing-library/react";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { setMode } from "../../redux/slices/sessionSlice";
import { renderWithProviders } from "../../util/test/render";
import { PermissionModeSelect } from "./PermissionModeSelect";

describe("PermissionModeSelect", () => {
  it("switches to bypass approvals mode", async () => {
    const { user, store } = await renderWithProviders(<PermissionModeSelect />);

    await user.click(screen.getByTestId("permission-mode-pill"));
    await user.click(screen.getByTestId("permission-mode-option-bypass"));

    expect(store.getState().ui.quickPermissionMode).toBe("bypass");
  });

  it("enables codebase wiring when restricted mode is selected", async () => {
    const mockIdeMessenger = new MockIdeMessenger();
    const postSpy = vi.spyOn(mockIdeMessenger, "post");

    const { user, store } = await renderWithProviders(
      <PermissionModeSelect />,
      {
        mockIdeMessenger,
      },
    );

    await user.click(screen.getByTestId("permission-mode-pill"));
    await user.click(screen.getByTestId("permission-mode-option-restrict"));

    expect(store.getState().ui.quickPermissionMode).toBe("restrict");
    expect(
      store.getState().config.config.experimental?.codebaseToolCallingOnly,
    ).toBe(true);
    expect(postSpy).toHaveBeenCalledWith("config/updateSharedConfig", {
      codebaseToolCallingOnly: true,
    });
  });

  it("moves to agent mode when autopilot is selected", async () => {
    const { user, store } = await renderWithProviders(<PermissionModeSelect />);

    act(() => {
      store.dispatch(setMode("plan"));
    });

    await user.click(screen.getByTestId("permission-mode-pill"));
    await user.click(screen.getByTestId("permission-mode-option-autopilot"));

    expect(store.getState().session.mode).toBe("agent");
    expect(store.getState().ui.quickPermissionMode).toBe("bypass");
  });
});
