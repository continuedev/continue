import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setupStore } from "../../../redux/store";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { renderWithProviders } from "../../../util/test/render";
import { ModeModelsTable } from "./ModeModelsTable";
import { box, saveButton, setupTable, star } from "./modeModelsTableTestUtils";

describe("ModeModelsTable: what it shows", () => {
  it("renders nothing when there are no chat models", async () => {
    const ideMessenger = new MockIdeMessenger();
    const store = setupStore({ ideMessenger });
    await renderWithProviders(<ModeModelsTable />, {
      store,
      mockIdeMessenger: ideMessenger,
    });
    expect(screen.queryByTestId("mode-models-table")).toBeNull();
  });

  it("shows the current config: ticks, default star and effort", async () => {
    await setupTable({
      plan: {
        title: "Bravo",
        titles: ["Bravo", "Alpha"],
        reasoningEffort: "high",
      },
    });
    expect(box("Plan", "Bravo").checked).toBe(true);
    expect(box("Plan", "Alpha").checked).toBe(true);
    expect(box("Plan", "Charlie").checked).toBe(false);
    expect(star("Plan", "Bravo").getAttribute("aria-pressed")).toBe("true");
    expect(star("Plan", "Alpha").getAttribute("aria-pressed")).toBe("false");
    expect(
      (screen.getByLabelText("Reasoning effort for Plan") as HTMLSelectElement)
        .value,
    ).toBe("high");
    expect(box("Agent", "Alpha").checked).toBe(false);
  });

  it("Save is disabled until something changes", async () => {
    await setupTable({ plan: { title: "Alpha", titles: ["Alpha", "Bravo"] } });
    expect(saveButton().disabled).toBe(true);
  });

  it("Reset throws away unsaved edits without saving", async () => {
    const { user, calls } = await setupTable({
      plan: { title: "Alpha", titles: ["Alpha"] },
    });
    await user.click(box("Plan", "Bravo"));
    expect(box("Plan", "Bravo").checked).toBe(true);
    await user.click(screen.getByText("Reset"));
    expect(box("Plan", "Bravo").checked).toBe(false);
    expect(saveButton().disabled).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("a model picked in a mode can be un-defaulted only by picking another", async () => {
    const { user } = await setupTable({
      plan: { title: "Alpha", titles: ["Alpha", "Bravo"] },
    });
    await user.click(star("Plan", "Bravo"));
    await waitFor(() =>
      expect(star("Plan", "Bravo").getAttribute("aria-pressed")).toBe("true"),
    );
    expect(star("Plan", "Alpha").getAttribute("aria-pressed")).toBe("false");
  });
});
