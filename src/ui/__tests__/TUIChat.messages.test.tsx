import {
  runTest,
  runTestSuite,
  sendMessage,
  waitForServerState,
} from "./TUIChat.testHelper.js";

runTestSuite("TUIChat - Message Handling", () => {
  describe("Message Display", () => {
    runTest(
      "renders user messages",
      async (ctx) => {
        const testMessage = "This is a test message";

        // Set up server to echo messages
        if (ctx.mode === "remote" && ctx.server) {
          ctx.server.onMessage((msg) => {
            ctx.server!.simulateResponse(`Echo: ${msg}`, false); // instant response
          });
        }

        // Send a message
        await sendMessage(ctx, testMessage);

        const frame = ctx.renderResult.lastFrame();

        // Should show the user message in the chat
        expect(frame).toContain(testMessage);

        // In remote mode, also check server state
        if (ctx.mode === "remote" && ctx.server) {
          const state = ctx.server.getState();
          expect(state.messages).toContainEqual(
            expect.objectContaining({
              role: "user",
              content: testMessage,
            })
          );
        }
      }
    );
  });

  describe("Chat History", () => {
    runTest(
      "preserves message history",
      async (ctx) => {
        // Set up server responses
        if (ctx.mode === "remote" && ctx.server) {
          let messageCount = 0;
          ctx.server.onMessage((msg) => {
            messageCount++;
            // Add a small delay to ensure state is ready
            setTimeout(() => {
              ctx.server!.simulateResponse(`Response ${messageCount}: ${msg}`, false);
            }, 50);
          });
        }

        // Send first message
        await sendMessage(ctx, "First message", 100);
        
        // Wait for response to complete
        if (ctx.mode === "remote" && ctx.server) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Send second message
        await sendMessage(ctx, "Second message", 100);
        
        // Wait for response to complete
        if (ctx.mode === "remote" && ctx.server) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        const frame = ctx.renderResult.lastFrame();

        // Both messages should be visible
        expect(frame).toContain("First message");
        expect(frame).toContain("Second message");

        // In remote mode, verify server state
        if (ctx.mode === "remote" && ctx.server) {
          const state = ctx.server.getState();
          expect(state.messages.filter(m => m.role === "user")).toHaveLength(2);
          expect(state.isResponding).toBe(false);
        }
      }
    );

    runTest(
      "handles long conversation history",
      async (ctx) => {
        // Set up server to respond quickly
        if (ctx.mode === "remote" && ctx.server) {
          ctx.server.onMessage((msg) => {
            // Add a small delay to ensure state is ready
            setTimeout(() => {
              ctx.server!.simulateResponse(`Ack: ${msg}`, false);
            }, 20);
          });
        }

        // Send multiple messages with delays
        for (let i = 0; i < 3; i++) { // Reduced from 5 to 3 for faster test
          await sendMessage(ctx, `Message ${i}`, 50);
          
          // Wait for response in remote mode
          if (ctx.mode === "remote" && ctx.server) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        const frame = ctx.renderResult.lastFrame();

        // Should contain some messages (exact count may vary due to scrolling)
        expect(frame).toMatch(/Message \d/);

        // In remote mode, verify all messages were received
        if (ctx.mode === "remote" && ctx.server) {
          const state = ctx.server.getState();
          const userMessages = state.messages.filter(m => m.role === "user");
          expect(userMessages).toHaveLength(3);
          expect(state.isResponding).toBe(false);
        }
      }
    );
  });

  describe("Error Handling", () => {
    runTest(
      "handles empty messages gracefully",
      async (ctx) => {
        // Send empty message
        ctx.renderResult.stdin.write("\r");

        await new Promise((resolve) => setTimeout(resolve, 50));

        const frame = ctx.renderResult.lastFrame();

        // Should still show the interface
        expect(frame).toContain("Ask anything");

        // In remote mode, verify no message was sent
        if (ctx.mode === "remote" && ctx.server) {
          const state = ctx.server.getState();
          expect(state.messages).toHaveLength(0);
        }
      }
    );

    runTest("displays interface when no initial prompt", ({ renderResult }) => {
      const frame = renderResult.lastFrame();

      // Should show the default interface
      expect(frame).toContain("Ask anything");
    });
  });
});
