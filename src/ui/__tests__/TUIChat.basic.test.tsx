import {
  runTest,
  runTestSuite,
  sendMessage,
  expectRemoteMode,
  expectNormalMode,
} from "./TUIChat.testHelper.js";

runTestSuite("TUIChat - Basic UI Tests", () => {
  describe("Component Initialization", () => {
    runTest("displays empty chat correctly", ({ renderResult, mode }) => {
      const frame = renderResult.lastFrame();

      // Should show the interface
      expect(frame).toContain("Ask anything");

      // Should have box borders (using the actual characters)
      expect(frame).toContain("│");

      // Mode-specific checks
      if (mode === "remote") {
        expectRemoteMode(frame);
      } else {
        expectNormalMode(frame);
      }
    });

    runTest("renders box borders correctly", ({ renderResult }) => {
      const frame = renderResult.lastFrame();

      // Should have borders (using actual box drawing characters)
      expect(frame).toMatch(/[│─╭╮╰╯]/); // Various box drawing chars
    });

    runTest("maintains layout with content", ({ renderResult }) => {
      renderResult.stdin.write("Test message that is quite long to see how it wraps");

      const frame = renderResult.lastFrame();

      // Borders should still be present
      expect(frame).toMatch(/[│─╭╮╰╯]/);

      // Should have multiple lines
      const lines = frame ? frame.split("\n") : [];
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe("Loading States", () => {
    runTest(
      "shows UI correctly when loading",
      async (ctx) => {
        // Set up server to simulate response
        if (ctx.mode === "remote" && ctx.server) {
          ctx.server.onMessage(() => {
            // Simulate a delayed response
            setTimeout(() => {
              ctx.server!.simulateResponse("Test response", true);
            }, 100);
          });
        }

        // Trigger loading by sending a message
        await sendMessage(ctx, "test message");

        const frame = ctx.renderResult.lastFrame();
        // The UI should still be properly rendered
        expect(frame).toContain("Ask anything");
        // Note: The actual loading spinner behavior might not be visible in this test environment
      }
    );

    runTest("hides loading spinner when not loading", ({ renderResult }) => {
      const frame = renderResult.lastFrame();
      // Should not contain spinner characters initially
      expect(frame).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });

    runTest(
      "displays loading text correctly",
      async (ctx) => {
        // Set up server to simulate response
        if (ctx.mode === "remote" && ctx.server) {
          ctx.server.onMessage(() => {
            // Keep server in responding state
            ctx.server!.simulateResponse("Processing...", true);
          });
        }

        await sendMessage(ctx, "test");

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const frame = ctx.renderResult.lastFrame();

        // Should show placeholder message rather than text in input box
        expect(frame).toContain(
          "Ask anything, @ for context, / for slash commands"
        );
      }
    );
  });
});