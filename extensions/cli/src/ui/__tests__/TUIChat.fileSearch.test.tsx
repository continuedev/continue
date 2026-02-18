import { renderInMode, testSingleMode } from "./TUIChat.dualModeHelper.js";
import { waitForCondition } from "./TUIChat.testHelper.js";

describe("TUIChat - @ File Search Tests", () => {
  testSingleMode("shows @ character when user types @", "local", async () => {
    const { lastFrame, stdin } = renderInMode("local");

    // Wait a bit for initial render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Type the @ character to trigger file search
    stdin.write("@");

    // Wait longer for file search to initialize and display files
    await new Promise((resolve) => setTimeout(resolve, 400));

    const frame = lastFrame()!;

    // Should show @ character in input or show file search UI
    const hasAtSymbol = frame.includes("@") || frame.includes("◉ @");
    expect(hasAtSymbol).toBe(true);

    // Local mode specific UI expectations
    expect(frame).not.toContain("Remote Mode");
    expect(frame).toContain("Continue CLI");
  });

  testSingleMode(
    "shows search text when user types after @",
    "local",
    async () => {
      const { lastFrame, stdin } = renderInMode("local");

      // Type @ followed by text to filter files
      stdin.write("@READ");

      let frame = lastFrame();

      await waitForCondition(() => {
        frame = lastFrame();
        return frame?.includes("@READ") ?? false;
      });

      expect(frame).toBeDefined();
      // Should show the typed text
      expect(frame).toContain("@READ");

      // Should show either navigation hints or at least indicate file search is working
      const hasNavigationHints = frame!.includes("↑/↓ to navigate");
      const hasFileSearch = frame!.includes("@READ");
      expect(hasNavigationHints || hasFileSearch).toBe(true);

      // Local mode specific UI expectations
      expect(frame).not.toContain("Remote Mode");
    },
  );

  testSingleMode("handles multiple @ characters", "local", async () => {
    const { lastFrame, stdin } = renderInMode("local");

    // Type multiple @ characters
    stdin.write("@@test");

    let frame = lastFrame();

    await waitForCondition(() => {
      frame = lastFrame();
      return frame?.includes("@@test") ?? false;
    });

    // Should handle multiple @ without crashing
    expect(frame).toBeDefined();
    expect(frame).toContain("@@test");

    // Local mode specific UI elements
    expect(frame).toContain("Continue CLI");
  });

  testSingleMode(
    "handles @ character input without crashing",
    "local",
    async () => {
      const { lastFrame, stdin } = renderInMode("local");

      // Type @ to trigger file search
      stdin.write("@");

      // Wait for potential async operations
      await new Promise((resolve) => setTimeout(resolve, 200));

      const frame = lastFrame()!;

      // Should not crash and show something
      expect(frame).toBeDefined();
      expect(frame.length).toBeGreaterThan(0);

      // Should show either navigation hints or at least the @ character in file search
      const hasNavigationHints = frame.includes("↑/↓ to navigate");
      const hasFileSearchUI = frame.includes("@");
      expect(hasNavigationHints || hasFileSearchUI).toBe(true);
    },
  );
});
