import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { box, saveButton, setupTable, star } from "./modeModelsTableTestUtils";

describe("ModeModelsTable: saving", () => {
  it("ticking two models sends a list with the first as default", async () => {
    const { user, calls } = await setupTable();
    await user.click(box("Agent", "Charlie"));
    await user.click(box("Agent", "Alpha"));
    expect(saveButton().disabled).toBe(false);
    await user.click(saveButton());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      agent: { model: "Charlie", models: ["Charlie", "Alpha"] },
    });
  });

  it("the star changes the default and moves it first", async () => {
    const { user, calls } = await setupTable({
      plan: { title: "Alpha", titles: ["Alpha", "Bravo"] },
    });
    await user.click(star("Plan", "Bravo"));
    await user.click(saveButton());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      plan: { model: "Bravo", models: ["Bravo", "Alpha"] },
    });
  });

  it("only the changed mode is sent", async () => {
    const { user, calls } = await setupTable({
      plan: { title: "Alpha", titles: ["Alpha", "Bravo"] },
      agent: { title: "Charlie" },
    });
    await user.click(box("Plan", "Bravo"));
    await user.click(saveButton());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(Object.keys(calls[0])).toEqual(["plan"]);
  });

  it("unticking everything in a mode removes its entry", async () => {
    const { user, calls } = await setupTable({
      plan: { title: "Alpha", titles: ["Alpha"] },
    });
    await user.click(box("Plan", "Alpha"));
    await user.click(saveButton());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ plan: null });
  });

  it("the effort select sends the chosen effort", async () => {
    const { user, calls } = await setupTable({
      agent: { title: "Alpha", titles: ["Alpha"] },
    });
    await user.selectOptions(
      screen.getByLabelText("Reasoning effort for Agent"),
      "low",
    );
    await user.click(saveButton());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].agent.reasoningEffort).toBe("low");
  });

  it("explains when there is no config.yaml to save to", async () => {
    const { user } = await setupTable(undefined, { saved: false });
    await user.click(box("Chat", "Alpha"));
    await user.click(saveButton());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "config.yaml",
    );
  });

  it("shows an error, keeps the edits and re-enables Save when saving throws", async () => {
    const { user } = await setupTable(undefined, "fail");
    await user.click(box("Chat", "Alpha"));
    await user.click(saveButton());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not save",
    );
    expect(box("Chat", "Alpha").checked).toBe(true);
    expect(saveButton().disabled).toBe(false);
    expect(saveButton().textContent).toBe("Save");
  });
});
