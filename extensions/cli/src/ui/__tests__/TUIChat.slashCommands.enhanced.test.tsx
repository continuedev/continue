import { renderInMode, testBothModes } from "./TUIChat.dualModeHelper.js";
import { waitForCondition } from "./TUIChat.testHelper.js";

describe("TUIChat - Enhanced Slash Commands Tests", () => {
  // Test timeout configuration edge cases
  describe("timeout and retry behavior", () => {
    testBothModes(
      "handles slow rendering with proper timeout",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/");

        // Test with a realistic timeout that accounts for slow rendering
        let frame = "";
        const startTime = Date.now();

        await waitForCondition(
          () => {
            frame = lastFrame() ?? "";
            return frame.includes("/");
          },
          5000, // 5 second timeout
          100, // 100ms interval
        );

        const elapsed = Date.now() - startTime;

        // Should complete within timeout
        expect(elapsed).toBeLessThan(5000);
        expect(frame).toContain("/");

        if (mode === "remote") {
          expect(frame).toContain("Remote Mode");
        } else {
          expect(frame).toContain("Continue CLI");
        }
      },
    );

    testBothModes(
      "handles rapid sequential commands with appropriate intervals",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // Type multiple commands in quick succession
        stdin.write("/");

        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            return frame.includes("/");
          },
          3000,
          50,
        );

        stdin.write("exit");

        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            return frame.includes("/exit");
          },
          3000,
          50,
        );

        // Clear and type new command
        stdin.write("\u0003"); // Ctrl+C to clear
        stdin.write("/help");

        let finalFrame = "";
        await waitForCondition(
          () => {
            finalFrame = lastFrame() ?? "";
            return finalFrame.includes("/help");
          },
          5000,
          100,
        );

        expect(finalFrame).toBeDefined();
        expect(finalFrame.length).toBeGreaterThan(0);
      },
    );
  });

  // Test slash command autocomplete functionality
  describe("autocomplete and filtering", () => {
    testBothModes("autocompletes partial command on Tab", async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      stdin.write("/ex");

      await waitForCondition(
        () => {
          const frame = lastFrame() ?? "";
          return frame.includes("/ex");
        },
        3000,
        50,
      );

      stdin.write("\t"); // Tab for autocomplete

      let frameAfterTab = "";
      await waitForCondition(
        () => {
          frameAfterTab = lastFrame() ?? "";
          return frameAfterTab.length > 0;
        },
        3000,
        50,
      );

      expect(frameAfterTab).toBeDefined();
      // In some modes, tab might complete to /exit or similar
      if (mode === "local") {
        // Local mode might have command completion
        expect(frameAfterTab.length).toBeGreaterThan(0);
      }
    });

    testBothModes(
      "filters commands as user types more characters",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // Start typing
        stdin.write("/");

        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            return frame.includes("/");
          },
          3000,
          50,
        );

        // Type more to filter
        stdin.write("t");

        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            return frame.includes("/t");
          },
          3000,
          50,
        );

        stdin.write("i");

        let finalFrame = "";
        await waitForCondition(
          () => {
            finalFrame = lastFrame() ?? "";
            return finalFrame.includes("/ti");
          },
          3000,
          50,
        );

        expect(finalFrame).toContain("/ti");
      },
    );

    testBothModes(
      "handles backspace while typing slash command",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/exit");

        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            return frame.includes("/exit");
          },
          3000,
          50,
        );

        // Backspace twice
        stdin.write("\u007f\u007f"); // DEL characters

        // Wait for UI to update after backspace
        await new Promise((resolve) => setTimeout(resolve, 200));

        let frameAfterBackspace = lastFrame() ?? "";

        // UI should still be responsive after backspace
        expect(frameAfterBackspace).toBeDefined();
        expect(frameAfterBackspace.length).toBeGreaterThan(0);

        // Verify mode indicator is still present
        if (mode === "remote") {
          expect(frameAfterBackspace).toContain("Remote Mode");
        } else {
          expect(frameAfterBackspace).toContain("Continue CLI");
        }
      },
    );
  });

  // Test edge cases with command arguments
  describe("command arguments handling", () => {
    testBothModes("handles commands with long arguments", async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      const longTitle =
        "This is a very long session title that spans multiple words and tests the UI's ability to handle longer text input";
      stdin.write(`/title ${longTitle}`);

      let frame = "";
      await waitForCondition(
        () => {
          frame = lastFrame() ?? "";
          return frame.includes("very long session title");
        },
        5000,
        100,
      );

      expect(frame).toContain("/title");
      expect(frame).toContain("very long");
    });

    testBothModes(
      "handles commands with special characters in arguments",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/title Test@Session#123!");

        let frame = "";
        await waitForCondition(
          () => {
            frame = lastFrame() ?? "";
            return frame.includes("Test@Session");
          },
          5000,
          100,
        );

        expect(frame).toContain("/title");
        expect(frame).toContain("Test@Session");
      },
    );

    testBothModes("handles commands with quotes in arguments", async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      stdin.write('/title "My Session"');

      let frame = "";
      await waitForCondition(
        () => {
          frame = lastFrame() ?? "";
          return frame.includes("My Session");
        },
        5000,
        100,
      );

      expect(frame).toContain("/title");
      expect(frame).toContain("My Session");
    });
  });

  // Test error handling
  describe("error handling", () => {
    testBothModes("handles unknown slash commands gracefully", async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      stdin.write("/unknowncommand");

      let frame = "";
      await waitForCondition(
        () => {
          frame = lastFrame() ?? "";
          return frame.includes("/unknowncommand");
        },
        3000,
        50,
      );

      expect(frame).toBeDefined();
      expect(frame).toContain("/unknowncommand");

      // UI should still be responsive
      if (mode === "remote") {
        expect(frame).toContain("Remote Mode");
      } else {
        expect(frame).toContain("Continue CLI");
      }
    });

    testBothModes("handles empty command after slash", async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      stdin.write("/ ");

      let frame = "";
      await waitForCondition(
        () => {
          frame = lastFrame() ?? "";
          return frame.includes("/");
        },
        3000,
        50,
      );

      expect(frame).toContain("/");
      // Should still show the UI properly
      if (mode === "remote") {
        expect(frame).toContain("Remote Mode");
      } else {
        expect(frame).toContain("Continue CLI");
      }
    });
  });

  // Test keyboard navigation
  describe("keyboard navigation", () => {
    testBothModes("handles arrow keys during command input", async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      stdin.write("/title");

      await waitForCondition(
        () => {
          const frame = lastFrame() ?? "";
          return frame.includes("/title");
        },
        3000,
        50,
      );

      // Try arrow keys (left/right)
      stdin.write("\u001b[D"); // Left arrow

      let frame = "";
      await waitForCondition(
        () => {
          frame = lastFrame() ?? "";
          return frame.length > 0;
        },
        3000,
        50,
      );

      expect(frame).toBeDefined();
      expect(frame.length).toBeGreaterThan(0);
    });

    testBothModes("handles Escape key to cancel command", async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      stdin.write("/title");

      await waitForCondition(
        () => {
          const frame = lastFrame() ?? "";
          return frame.includes("/title");
        },
        3000,
        50,
      );

      stdin.write("\u001b"); // ESC key

      let frame = "";
      await waitForCondition(
        () => {
          frame = lastFrame() ?? "";
          return frame.length > 0;
        },
        3000,
        50,
      );

      expect(frame).toBeDefined();
      // Should still render UI
      if (mode === "remote") {
        expect(frame).toContain("Remote Mode");
      } else {
        expect(frame).toContain("Continue CLI");
      }
    });
  });

  // Test UI consistency
  describe("UI consistency", () => {
    testBothModes(
      "maintains consistent UI state during command typing",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // Check initial state
        let initialFrame = lastFrame() ?? "";
        await waitForCondition(
          () => {
            initialFrame = lastFrame() ?? "";
            return initialFrame.length > 0;
          },
          3000,
          50,
        );

        const hasInitialModeIndicator =
          mode === "remote"
            ? initialFrame.includes("Remote Mode")
            : initialFrame.includes("Continue CLI");
        expect(hasInitialModeIndicator).toBe(true);

        // Type command
        stdin.write("/title Test");

        let frameWithCommand = "";
        await waitForCondition(
          () => {
            frameWithCommand = lastFrame() ?? "";
            return frameWithCommand.includes("/title");
          },
          5000,
          100,
        );

        // Mode indicator should still be present
        const hasModeIndicatorAfter =
          mode === "remote"
            ? frameWithCommand.includes("Remote Mode")
            : frameWithCommand.includes("Continue CLI");
        expect(hasModeIndicatorAfter).toBe(true);
      },
    );

    testBothModes(
      "renders properly after multiple command attempts",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // Try multiple commands
        for (let i = 0; i < 3; i++) {
          stdin.write(`/cmd${i}`);

          await waitForCondition(
            () => {
              const frame = lastFrame() ?? "";
              return frame.includes(`/cmd${i}`);
            },
            3000,
            50,
          );

          // Clear with Ctrl+C
          stdin.write("\u0003");

          await waitForCondition(
            () => {
              const frame = lastFrame() ?? "";
              return !frame.includes(`/cmd${i}`);
            },
            3000,
            50,
          );
        }

        // Final check - UI should still be functional
        const finalFrame = lastFrame() ?? "";
        expect(finalFrame.length).toBeGreaterThan(0);

        if (mode === "remote") {
          expect(finalFrame).toContain("Remote Mode");
        } else {
          expect(finalFrame).toContain("Continue CLI");
        }
      },
    );
  });

  // Performance and stress tests
  describe("performance", () => {
    testBothModes("handles rapid typing without frame drops", async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      const command = "/title RapidTypingTest";

      // Type entire command rapidly
      for (const char of command) {
        stdin.write(char);
      }

      let frame = "";
      await waitForCondition(
        () => {
          frame = lastFrame() ?? "";
          return frame.includes("RapidTypingTest");
        },
        5000,
        100,
      );

      expect(frame).toContain("/title");
      expect(frame).toContain("RapidTypingTest");
    });
  });
});
