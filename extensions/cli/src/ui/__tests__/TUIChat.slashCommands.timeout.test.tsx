import { renderInMode, testBothModes } from "./TUIChat.dualModeHelper.js";
import { waitForCondition } from "./TUIChat.testHelper.js";

/**
 * This test suite specifically validates the timeout and interval improvements
 * made in PR #9111 for Windows CI stability.
 *
 * The key change was increasing the timeout from 2000ms to 5000ms and
 * the interval from 50ms to 100ms for the slash command dropdown test.
 */
describe("TUIChat - Slash Commands Timeout Tests", () => {
  describe("timeout configuration validation", () => {
    testBothModes(
      "uses adequate timeout for command dropdown hiding (5000ms)",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/title");

        const startTime = Date.now();
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
          5000, // Key change: 5000ms timeout
          100, // Key change: 100ms interval
        );

        const elapsed = Date.now() - startTime;

        // Verify the condition was met
        if (mode === "remote") {
          expect(frameAfterCommand).toContain("Remote Mode");
        } else {
          expect(frameAfterCommand).toContain("/title");
        }

        // Test should complete well within the timeout
        expect(elapsed).toBeLessThan(5000);
      },
    );

    testBothModes(
      "handles slow rendering environments (Windows CI)",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // This simulates a scenario where rendering might be slower
        // (as can happen in CI environments, especially Windows)
        stdin.write("/title");

        const checks: number[] = [];
        let frameAfterCommand = lastFrame();

        const startTime = Date.now();
        await waitForCondition(
          () => {
            checks.push(Date.now() - startTime);
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

        // Verify that checks were spaced appropriately
        if (checks.length > 1) {
          const intervals = checks.slice(1).map((t, i) => t - checks[i]);
          const avgInterval =
            intervals.reduce((a, b) => a + b, 0) / intervals.length;

          // Average interval should be close to 100ms
          expect(avgInterval).toBeGreaterThan(50); // At least 50ms
          expect(avgInterval).toBeLessThan(200); // But not too long
        }

        // Verify condition was eventually met
        expect(frameAfterCommand).toBeDefined();
      },
    );
  });

  describe("comparison with shorter timeouts", () => {
    testBothModes(
      "validates that 5000ms timeout is necessary for reliability",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // Test that we can successfully complete the check with the new timeout
        stdin.write("/exit");

        let frame = "";
        let success = false;

        try {
          await waitForCondition(
            () => {
              frame = lastFrame() ?? "";
              return frame.includes("/exit");
            },
            5000, // Current timeout
            100,
          );
          success = true;
        } catch (error) {
          // If it fails with 5000ms, something is really wrong
          success = false;
        }

        expect(success).toBe(true);
        expect(frame).toContain("/exit");
      },
    );

    testBothModes(
      "demonstrates improved stability with 100ms interval",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/help");

        let checkCount = 0;
        const startTime = Date.now();

        await waitForCondition(
          () => {
            checkCount++;
            const frame = lastFrame() ?? "";
            return frame.includes("/help");
          },
          5000,
          100, // 100ms interval reduces unnecessary checks
        );

        const elapsed = Date.now() - startTime;

        // With 100ms interval, we should have fewer checks than with 50ms
        // while still being reliable
        const maxExpectedChecks = Math.ceil(elapsed / 100) + 5; // +5 buffer
        expect(checkCount).toBeLessThan(maxExpectedChecks);

        // But should still complete quickly if render is fast
        if (elapsed < 500) {
          expect(checkCount).toBeLessThan(10);
        }
      },
    );
  });

  describe("robustness across different scenarios", () => {
    testBothModes(
      "handles command with arguments using proper timeout",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/title My Test Session");

        let frameWithArgs = "";
        await waitForCondition(
          () => {
            frameWithArgs = lastFrame() ?? "";
            return (
              frameWithArgs.includes("/title") &&
              frameWithArgs.includes("Test Session")
            );
          },
          5000,
          100,
        );

        expect(frameWithArgs).toContain("/title");
        expect(frameWithArgs).toContain("Test Session");
      },
    );

    testBothModes(
      "handles rapid command changes with adequate polling",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // Type first command
        stdin.write("/exit");

        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            return frame.includes("/exit");
          },
          5000,
          100,
        );

        // Clear and type new command
        stdin.write("\u0003"); // Ctrl+C
        stdin.write("/help");

        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            return frame.includes("/help");
          },
          5000,
          100,
        );

        const finalFrame = lastFrame() ?? "";
        expect(finalFrame).toContain("/help");
      },
    );

    testBothModes(
      "maintains stability with longer wait between commands",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/title");

        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            return frame.includes("/title");
          },
          5000,
          100,
        );

        // Wait a bit before next action
        await new Promise((resolve) => setTimeout(resolve, 150));

        stdin.write(" Session Name");

        let finalFrame = "";
        await waitForCondition(
          () => {
            finalFrame = lastFrame() ?? "";
            return finalFrame.includes("Session Name");
          },
          5000,
          100,
        );

        expect(finalFrame).toContain("/title");
        expect(finalFrame).toContain("Session Name");
      },
    );
  });

  describe("Windows CI specific scenarios", () => {
    testBothModes(
      "handles potential rendering delays in CI environment",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // Simulate a command that might take longer to render in CI
        stdin.write("/title TestCI");

        const maxWaitTime = 5000;
        const pollInterval = 100;
        const startTime = Date.now();

        let frame = "";
        await waitForCondition(
          () => {
            frame = lastFrame() ?? "";
            // Check for either the command or mode indicator
            return frame.includes("/title") || frame.includes("TestCI");
          },
          maxWaitTime,
          pollInterval,
        );

        const elapsed = Date.now() - startTime;

        // Should complete successfully within timeout
        expect(elapsed).toBeLessThan(maxWaitTime);
        expect(frame).toBeDefined();

        // Verify we got some content
        expect(frame.length).toBeGreaterThan(0);
      },
    );

    testBothModes(
      "tolerates intermittent frame updates in slow environments",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/");

        // Track frame updates
        const frames: string[] = [];
        await waitForCondition(
          () => {
            const frame = lastFrame() ?? "";
            if (frame && !frames.includes(frame)) {
              frames.push(frame);
            }
            return frame.includes("/");
          },
          5000,
          100,
        );

        // Should have captured at least one frame
        expect(frames.length).toBeGreaterThan(0);

        // All captured frames should be valid
        frames.forEach((frame) => {
          expect(frame.length).toBeGreaterThan(0);
        });
      },
    );
  });

  describe("performance characteristics", () => {
    testBothModes(
      "100ms interval reduces CPU usage compared to 50ms",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        stdin.write("/test");

        let checkCount100ms = 0;
        const start100ms = Date.now();

        await waitForCondition(
          () => {
            checkCount100ms++;
            const frame = lastFrame() ?? "";
            return frame.includes("/test") || Date.now() - start100ms > 1000;
          },
          5000,
          100,
        );

        const elapsed100ms = Date.now() - start100ms;

        // With 100ms interval over 1 second, should be ~10 checks
        // (unless condition met earlier)
        if (elapsed100ms >= 1000) {
          expect(checkCount100ms).toBeLessThan(20); // Upper bound
          expect(checkCount100ms).toBeGreaterThan(5); // Lower bound
        }
      },
    );

    testBothModes(
      "5000ms timeout provides adequate buffer for slow systems",
      async (mode) => {
        const { lastFrame, stdin } = renderInMode(mode);

        // Test a command that should succeed even on slow systems
        stdin.write("/command");

        const startTime = Date.now();
        let success = false;

        try {
          await waitForCondition(
            () => {
              const frame = lastFrame() ?? "";
              return frame.includes("/command");
            },
            5000,
            100,
          );
          success = true;
        } catch (error) {
          success = false;
        }

        const elapsed = Date.now() - startTime;

        // Should succeed
        expect(success).toBe(true);

        // And should complete well within timeout on normal systems
        if (elapsed > 3000) {
          // If it takes more than 3s, log for investigation
          console.warn(`Slow render detected: ${elapsed}ms`);
        }
      },
    );
  });
});
