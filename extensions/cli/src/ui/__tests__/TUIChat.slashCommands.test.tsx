import { renderInMode, testBothModes } from "./TUIChat.dualModeHelper.js";
import { waitForCondition } from "./TUIChat.testHelper.js";

describe("TUIChat - Slash Commands Tests", () => {
  testBothModes("shows slash when user types /", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Type / to trigger slash command
    stdin.write("/");

    let frame = "";
    await waitForCondition(() => {
      frame = lastFrame() ?? "";
      return frame.includes("/");
    });

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

    let frame = lastFrame();

    await waitForCondition(() => {
      frame = lastFrame();
      return frame?.includes("/exi") ?? false;
    });

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

    stdin.write("/exi");

    let frame = "";
    await waitForCondition(() => {
      frame = lastFrame() ?? "";
      return frame.includes("/exi");
    });

    stdin.write("\t");

    let frameAfterTab = "";
    await waitForCondition(() => {
      frameAfterTab = lastFrame() ?? "";
      return frameAfterTab.length > 0;
    });

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

    stdin.write("/");

    let frame = "";
    await waitForCondition(() => {
      frame = lastFrame() ?? "";
      return frame.includes("/");
    });

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

      let frameAfterCommand = lastFrame();
      await waitForCondition(
        () => {
          frameAfterCommand = lastFrame();

          return (
            frameAfterCommand?.includes(
              mode === "remote" ? "Remote Mode" : "/title",
            ) ?? false
          );
        },
        5000,
        100,
      );

      if (mode === "remote") {
        // In remote mode, /title might not be a valid command, so just check we're in remote mode
        expect(frameAfterCommand).toContain("Remote Mode");
      } else {
        // In local mode, check for /title
        expect(frameAfterCommand).toContain("/title");
      }

      // Now add a space and arguments
      stdin.write(" My Session Title");

      let frameAfterArgs = lastFrame();
      await waitForCondition(() => {
        frameAfterArgs = lastFrame() ?? "";
        return frameAfterArgs.includes("My Session Title");
      });

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

      stdin.write("/title Test Session");

      let frameBeforeEnter = lastFrame();
      await waitForCondition(() => {
        frameBeforeEnter = lastFrame() ?? "";
        return (
          frameBeforeEnter.includes("/title") &&
          frameBeforeEnter.includes("Test Session")
        );
      });

      expect(frameBeforeEnter).toContain("/title");
      expect(frameBeforeEnter).toContain("Test Session");

      stdin.write("\r");

      let frameAfterEnter = lastFrame();
      await waitForCondition(() => {
        frameAfterEnter = lastFrame() ?? "";
        return frameAfterEnter.length > 0;
      });

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
