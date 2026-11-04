import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../redux/slices/configSlice";
import { setApprovalMode } from "../../redux/slices/uiSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { ApprovalSelect, YoloBanner } from "./ApprovalSelect";

async function setup(experimental = false) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(
    <>
      <ApprovalSelect />
      <YoloBanner />
    </>,
    { store, mockIdeMessenger: ideMessenger },
  );
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        experimental: { enableAutoApproval: experimental },
      } as any),
    );
  });
  return { ...view, store };
}

describe("ApprovalSelect", () => {
  it("defaults to Manual and shows no warning", async () => {
    const { store } = await setup();
    expect(store.getState().ui.approvalMode).toBe("manual");
    expect(screen.getByTestId("approval-select").textContent).toContain(
      "Manual",
    );
    expect(screen.queryByTestId("yolo-banner")).toBeNull();
  });

  it("offers Manual, Auto-approve and YOLO, and Auto only when experimental", async () => {
    const { user } = await setup();
    await user.click(screen.getByTestId("approval-select"));
    expect(screen.getByTestId("approval-option-manual")).toBeDefined();
    expect(screen.getByTestId("approval-option-autoApprove")).toBeDefined();
    expect(screen.getByTestId("approval-option-yolo")).toBeDefined();
    expect(screen.queryByTestId("approval-option-auto")).toBeNull();
  });

  it("Auto is listed but disabled until a reviewer model is chosen", async () => {
    const { user } = await setup(true);
    await user.click(screen.getByTestId("approval-select"));
    const auto = screen.getByTestId("approval-option-auto");
    expect(auto.textContent).toContain("Not available");
    expect(auto.getAttribute("data-disabled")).not.toBeNull();
  });

  it("choosing YOLO switches the mode and shows a warning that stays", async () => {
    const { user, store } = await setup();
    await user.click(screen.getByTestId("approval-select"));
    await user.click(screen.getByTestId("approval-option-yolo"));
    expect(store.getState().ui.approvalMode).toBe("yolo");
    const banner = screen.getByTestId("yolo-banner");
    expect(banner.textContent).toContain("Deny rules");
    // Unrelated state changes do not remove it.
    await act(async () => {
      store.dispatch(setApprovalMode("yolo"));
    });
    expect(screen.getByTestId("yolo-banner")).toBeDefined();
  });

  it("the banner's button goes back to Manual", async () => {
    const { user, store } = await setup();
    await act(async () => {
      store.dispatch(setApprovalMode("yolo"));
    });
    await user.click(screen.getByText("Switch to Manual"));
    expect(store.getState().ui.approvalMode).toBe("manual");
    expect(screen.queryByTestId("yolo-banner")).toBeNull();
  });
});
