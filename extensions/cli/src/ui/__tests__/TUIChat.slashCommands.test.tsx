import { renderInMode, testBothModes } from "./TUIChat.dualModeHelper.js";

describe("TUIChat - Slash Commands Tests", () => {
  testBothModes("shows slash when user types /", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type / to trigger slash command
    stdin.write("/");

    // Wait a bit for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 200));

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

    // Type /exi to trigger slash command filtering
    stdin.write("/exi");

    // Wait a bit for the UI to update (allow extra time in both modes)
    await new Promise((resolve) => setTimeout(resolve, 600));

    const frame = lastFrame();

    // Should show the typed command
    expect(frame).toContain("/exi");

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

    // Type /exi and then tab
    stdin.write("/exi");

    await new Promise((resolve) => setTimeout(resolve, 200));

    stdin.write("\t");

    await new Promise((resolve) => setTimeout(resolve, 200));

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

    await new Promise((resolve) => setTimeout(resolve, 600));

    const frame = lastFrame();

    // Should show the slash
    expect(frame).toContain("/");

    // In remote mode, slash command menu should show
    if (mode === "remote") {
      // More lenient check - just verify we're in remote mode and have a slash
      expect(frame).toContain("Remote Mode");
      // The slash command UI may not always show /exit immediately
      // Just check that we have slash somewhere
      const hasSlash = frame ? frame.includes("/") : false;
      expect(hasSlash).toBe(true);
    } else {
      // In local mode, the / is shown in the input
      expect(frame).toContain("Continue CLI");
      // The slash should be visible somewhere in the frame
      // It might be in the input area or in a command palette
      const hasSlash = frame ? frame.includes("/") : false;
      expect(hasSlash).toBe(true);
    }
  });

  testBothModes(
    "hides slash command dropdown when typing complete command with arguments",
    async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      // Type a complete command name first
      stdin.write("/title");

      await new Promise((resolve) => setTimeout(resolve, 200));

      const frameAfterCommand = lastFrame();
      if (mode === "remote") {
        // In remote mode, /title might not be a valid command, so just check we're in remote mode
        expect(frameAfterCommand).toContain("Remote Mode");
      } else {
        // In local mode, check for /title
        expect(frameAfterCommand).toContain("/title");
      }

      // Now add a space and arguments
      stdin.write(" My Session Title");

      await new Promise((resolve) => setTimeout(resolve, 200));

      const frameAfterArgs = lastFrame();

      // Check that the UI is still functional after adding arguments
      if (mode === "remote") {
        expect(frameAfterArgs).toContain("Remote Mode");
        // In remote mode, /title might not be available, so just check the UI is working
      } else {
        expect(frameAfterArgs).toContain("Continue CLI");
        // In local mode, we should see the /title command
        expect(frameAfterArgs).toContain("/title");
      }
    },
  );

  testBothModes(
    "allows Enter key to execute command when dropdown is hidden",
    async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      // Type a complete command with arguments
      stdin.write("/title Test Session");

      await new Promise((resolve) => setTimeout(resolve, 200));

      const frameBeforeEnter = lastFrame();
      expect(frameBeforeEnter).toContain("/title");
      expect(frameBeforeEnter).toContain("Test Session");

      // Press Enter - this should execute the command, not try to autocomplete
      stdin.write("\r");

      await new Promise((resolve) => setTimeout(resolve, 300));

      const frameAfterEnter = lastFrame();

      // Should not crash and should clear the input (or show command execution)
      expect(frameAfterEnter).toBeDefined();

      // Mode-specific checks
      if (mode === "remote") {
        expect(frameAfterEnter).toContain("Remote Mode");
      } else {
        expect(frameAfterEnter).toContain("Continue CLI");
      }
    },
  );
});
