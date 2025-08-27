import { testBothModes, renderInMode } from "./TUIChat.dualModeHelper.js";

describe("TUIChat - @ File Search Tests", () => {
  testBothModes("shows @ character when user types @", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Wait a bit for initial render
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Type the @ character to trigger file search
    stdin.write("@");

    // Wait longer for file search to initialize and display files
    await new Promise((resolve) => setTimeout(resolve, 200));

    const frame = lastFrame()!;

    // Should show @ character in input or show file search UI
    // The @ might be in the input line or in a file search UI
    const hasAtSymbol = frame.includes("@") || frame.includes("◉ @");
    expect(hasAtSymbol).toBe(true);

    // Mode-specific UI
    if (mode === "remote") {
      expect(frame).toContain("Remote Mode");
    } else {
      expect(frame).not.toContain("Remote Mode");
      expect(frame).toContain("Continue CLI");
    }
  });

  testBothModes("shows search text when user types after @", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type @ followed by text to filter files
    stdin.write("@READ");

    // Wait for file search to filter and display results
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame()!;

    // Should show the typed text
    expect(frame).toContain("@READ");

    // In local mode, should show either navigation hints or files
    if (mode === "local") {
      // Should show either navigation hints or at least indicate file search is working
      const hasNavigationHints = frame.includes("↑/↓ to navigate");
      const hasFileSearch =
        frame.includes("@READ") && !frame.includes("Remote Mode");
      expect(hasNavigationHints || hasFileSearch).toBe(true);
    }

    // Mode-specific checks
    if (mode === "remote") {
      expect(frame).toContain("Remote Mode");
    } else {
      expect(frame).not.toContain("Remote Mode");
    }
  });

  testBothModes("handles multiple @ characters", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type multiple @ characters
    stdin.write("@@test");

    // Wait for UI update
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame();

    // Should handle multiple @ without crashing
    expect(frame).toBeDefined();
    expect(frame).toContain("@@test");

    // Mode-specific UI elements
    if (mode === "remote") {
      expect(frame).toContain("Remote Mode");
    } else {
      expect(frame).toContain("Continue CLI");
    }
  });

  testBothModes("handles @ character input without crashing", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type @ to trigger file search
    stdin.write("@");

    // Wait for potential async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame()!;

    // Should not crash and show something
    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);

    // In local mode, should show either navigation hints or file search UI
    if (mode === "local") {
      // Should show either navigation hints or at least the @ character in file search
      const hasNavigationHints = frame.includes("↑/↓ to navigate");
      const hasFileSearchUI =
        frame.includes("@") && !frame.includes("Remote Mode");
      expect(hasNavigationHints || hasFileSearchUI).toBe(true);
    }
  });
});
