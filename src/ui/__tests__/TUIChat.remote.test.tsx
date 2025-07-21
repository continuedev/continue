import {
  runTest,
  runTestSuite,
  sendMessage,
  waitForServerState,
  expectRemoteMode,
  expectNormalMode,
} from "./TUIChat.testHelper.js";

describe("TUIChat - Remote Mode Specific Tests", () => {
  // Test that only runs in remote mode
  runTest(
    "shows remote mode indicators",
    ({ renderResult }) => {
      const frame = renderResult.lastFrame();
      expectRemoteMode(frame);
      
      // Check specific remote mode UI elements
      expect(frame).toContain("◉");
      expect(frame).toContain("Remote Mode");
      
      // Should NOT show normal mode indicators
      expect(frame).not.toContain("● Continue CLI");
    },
    { mode: "remote" }
  );

  // Test that only runs in normal mode
  runTest(
    "shows normal mode indicators",
    ({ renderResult }) => {
      const frame = renderResult.lastFrame();
      expectNormalMode(frame);
      
      // Should NOT show remote mode indicators
      expect(frame).not.toContain("◉ Remote Mode");
    },
    { mode: "normal" }
  );

  // Test HTTP polling behavior (remote only)
  runTest(
    "polls server for state updates",
    async (ctx) => {
      if (!ctx.server) throw new Error("Server not available");

      // Initial state should be empty
      expect(ctx.server.getState().messages).toHaveLength(0);

      // Simulate server-side message addition
      ctx.server.getState().messages.push({
        role: "assistant",
        content: "Server-initiated message",
        messageType: "chat",
      });

      // Wait for the UI to poll and update
      await new Promise(resolve => setTimeout(resolve, 600)); // Polling interval is 500ms

      const frame = ctx.renderResult.lastFrame();
      
      // The UI should show the server-initiated message
      expect(frame).toContain("Server-initiated message");
    },
    { mode: "remote" }
  );

  // Test interrupt handling in remote mode
  runTest(
    "handles interrupts via empty message",
    async (ctx) => {
      if (!ctx.server) throw new Error("Server not available");

      // Test the interrupt mechanism directly
      // Set initial state as if a response is in progress
      ctx.server.getState().isResponding = true;
      ctx.server.getState().responseInProgress = true;
      ctx.server.getState().messages.push(
        { role: "user", content: "Test message", messageType: "chat" },
        { role: "assistant", content: "Starting response...", messageType: "chat" }
      );

      // Send interrupt signal (empty message)
      await fetch(`${ctx.remoteUrl}/message`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "", interrupt: true }),
      });

      // Server should immediately stop responding
      const state = ctx.server.getState();
      expect(state.isResponding).toBe(false);
      expect(state.responseInProgress).toBe(false);
    },
    { mode: "remote" }
  );

  // Test streaming responses in remote mode
  runTest(
    "displays streaming responses character by character",
    async (ctx) => {
      if (!ctx.server) throw new Error("Server not available");

      const responseText = "Hello world!";
      
      // Set up server to stream response
      ctx.server.onMessage(() => {
        ctx.server!.simulateResponse(responseText, true);
      });

      // Send message
      await sendMessage(ctx, "Say hello");

      // Wait a bit for streaming to start
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Check intermediate streaming states
      for (let i = 1; i <= responseText.length; i++) {
        const state = ctx.server.getState();
        
        // Check the current streaming state
        if (state.responseText.length > 0 && state.responseText.length < responseText.length) {
          expect(state.isResponding).toBe(true);
          // Response text should be building up
          expect(state.responseText.length).toBeGreaterThanOrEqual(i - 1);
        }
        
        await new Promise(resolve => setTimeout(resolve, 12)); // Slightly longer than streaming delay
      }

      // Final state check
      await new Promise(resolve => setTimeout(resolve, 50));
      const finalState = ctx.server.getState();
      expect(finalState.isResponding).toBe(false);
      expect(finalState.responseText).toBe(responseText);
      
      // Check UI shows complete response
      const frame = ctx.renderResult.lastFrame();
      expect(frame).toContain(responseText);
    },
    { mode: "remote" }
  );
});

// Test suite that runs in both modes but with different behavior
runTestSuite("TUIChat - Mode-Aware Behavior", () => {
  runTest(
    "displays correct branding based on mode",
    ({ renderResult, mode }) => {
      const frame = renderResult.lastFrame();
      
      if (mode === "remote") {
        // Remote mode shows different branding
        expect(frame).toContain("Remote Mode");
        expect(frame).not.toContain("Continue CLI");
      } else {
        // Normal mode shows standard branding
        expect(frame).toContain("Continue CLI");
        expect(frame).not.toContain("Remote Mode");
      }
    }
  );

  runTest(
    "uses correct message handling based on mode",
    async (ctx) => {
      const testMessage = "Test message";
      
      if (ctx.mode === "remote" && ctx.server) {
        // In remote mode, messages go through HTTP
        let messageReceived = false;
        ctx.server.onMessage((msg) => {
          messageReceived = true;
          expect(msg).toBe(testMessage);
          ctx.server!.simulateResponse("Remote response", false); // instant response
        });
        
        await sendMessage(ctx, testMessage);
        
        // Verify message was sent via HTTP
        expect(messageReceived).toBe(true);
        
        // Verify response appears
        await waitForServerState(
          ctx.server,
          state => {
            const assistantMsg = state.messages.find((m: any) => m.role === "assistant");
            return assistantMsg && assistantMsg.content === "Remote response";
          },
          2000
        );
      } else {
        // In normal mode, messages are handled locally
        await sendMessage(ctx, testMessage);
        
        // Just verify message appears (local handling)
        const frame = ctx.renderResult.lastFrame();
        expect(frame).toContain(testMessage);
      }
    }
  );
});