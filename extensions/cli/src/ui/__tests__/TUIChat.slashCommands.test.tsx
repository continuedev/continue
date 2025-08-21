import { testBothModes, renderInMode } from "./TUIChat.dualModeHelper.js";

describe("TUIChat - Slash Commands Tests", () => {
  testBothModes("shows slash when user types /", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type / to trigger slash command
    stdin.write("/");

    // Wait a bit for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the slash character
    expect(frame).toContain("/");

    // Mode-specific assertions
    if (mode === "remote") {
      expect(frame).toContain("Remote Mode");
    } else {
      expect(frame).not.toContain("Remote Mode");
      expect(frame).toContain("Continue CLI");
    }
  });

  testBothModes("filters slash commands when typing /log", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type /log to trigger slash command filtering
    stdin.write("/log");

    // Wait a bit for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the typed command
    expect(frame).toContain("/log");

    // Mode-specific UI elements
    if (mode === "remote") {
      expect(frame).toContain("Remote Mode");
    } else {
      expect(frame).not.toContain("Remote Mode");
      expect(frame).toContain("Continue CLI");
    }
  });

  testBothModes("handles tab key after slash command", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type /log and then tab
    stdin.write("/log");

    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("\t");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frameAfterTab = lastFrame();

    // Should not crash after tab
    expect(frameAfterTab).toBeDefined();
    if (frameAfterTab) {
      expect(frameAfterTab.length).toBeGreaterThan(0);

      // Mode-specific checks
      if (mode === "remote") {
        expect(frameAfterTab).toContain("Remote Mode");
      } else {
        expect(frameAfterTab).not.toContain("Remote Mode");
      }
    }
  });

  testBothModes("shows slash command menu when typing /", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type just /
    stdin.write("/");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the slash
    expect(frame).toContain("/");

    // In remote mode, slash command menu shows immediately
    if (mode === "remote") {
      expect(frame).toContain("/exit");
      expect(frame).toContain("Remote Mode");
    } else {
      // In local mode, the / is shown in the input
      expect(frame).toContain("Continue CLI");
      // The slash should be visible somewhere in the frame
      // It might be in the input area or in a command palette
      const hasSlash = frame ? frame.includes("/") : false;
      expect(hasSlash).toBe(true);
    }
  });
});
