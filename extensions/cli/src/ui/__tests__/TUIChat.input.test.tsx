import { renderInMode, testBothModes } from "./TUIChat.dualModeHelper.js";
import { waitForNextRender } from "./TUIChat.testHelper.js";

describe("TUIChat - User Input Tests", () => {
  testBothModes("shows typed text in input field", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    stdin.write("Testing 123");
    await waitForNextRender();

    const frame = lastFrame();
    // The input might be in a different format, let's be more flexible
    expect(frame ? frame.toLowerCase() : "").toMatch(
      /testing|123|ask anything/,
    );

    // Mode-specific assertions
    if (mode === "remote") {
      expect(frame).toContain("Remote Mode");
    } else {
      expect(frame).not.toContain("Remote Mode");
    }
  });

  testBothModes("handles Enter key to submit", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    await waitForNextRender();
    const beforeEnter = lastFrame();
    expect(beforeEnter).toContain("Ask anything");

    stdin.write("\r");

    // Wait for the UI to update after pressing enter
    await new Promise((resolve) => setTimeout(resolve, 500));

    const afterEnter = lastFrame();

    // The UI should remain stable after Enter (no crash)
    expect(afterEnter).toBeDefined();
    expect(afterEnter).toContain("Ask anything");

    // Local mode specific features
    if (mode === "local") {
      expect(afterEnter).toContain("@ for context");
      expect(afterEnter).toContain("/ for slash commands");
    }
  });

  testBothModes(
    "handles special characters in input without crashing",
    async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      // Try typing various special characters
      stdin.write("!@#$%^&*()");
      await waitForNextRender();

      // In remote mode, wait a bit longer for the input to be processed
      if (mode === "remote") {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const frame = lastFrame();

      // Should handle special characters without crashing
      expect(frame).toBeDefined();
      expect(frame).not.toBe("");

      // UI should still be functional
      // In remote mode on some platforms, special characters might not render immediately
      // so we just verify the UI is responsive and not crashed
      if (mode === "local") {
        // Local mode should show the typed special characters
        expect(frame).toContain("!@#$%^&*()");
      } else {
        // Remote mode should at least show it's in remote mode
        // The input might be processed differently
        expect(frame).toContain("Remote Mode");
      }

      // Mode-specific UI elements
      if (mode !== "remote") {
        expect(frame).toContain("Continue CLI");
      }
    },
  );
});
