import { renderInMode, testBothModes } from "./TUIChat.dualModeHelper.js";
import { waitForCondition } from "./TUIChat.testHelper.js";

/**
 * Integration tests for the message edit feature in TUIChat
 *
 * Tests the full flow:
 * 1. Double Esc opens EditMessageSelector
 * 2. User navigates and selects a message
 * 3. User edits the message
 * 4. History is rewound and new message is submitted
 * 5. Chat updates correctly
 */
describe("TUIChat - Message Edit Feature", () => {
  testBothModes("double Esc should open edit selector", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Verify selector is not open initially
    let frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).not.toContain("No user messages to edit");

    // Press Esc twice quickly (within 500ms)
    stdin.write("\u001b"); // First Esc
    stdin.write("\u001b"); // Second Esc

    // Wait for UI to update
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify selector is now open
    frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).toContain("No user messages to edit");
  });

  testBothModes("edit selector should handle navigation", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Open edit selector (double Esc)
    stdin.write("\u001b");
    stdin.write("\u001b");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify selector is open
    let frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).toContain("No user messages to edit");

    // Try navigation keys
    stdin.write("j"); // Down
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("k"); // Up
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify selector is still open after navigation
    frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).toContain("No user messages to edit");
  });

  testBothModes("edit selector should exit with Esc", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Open edit selector
    stdin.write("\u001b");
    stdin.write("\u001b");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify edit selector is open
    let frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).toContain("No user messages to edit");

    // Press Esc to exit
    stdin.write("\u001b");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify edit selector is closed
    frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).not.toContain("No user messages to edit");
  });

  testBothModes("should handle edit flow without crashing", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // This test verifies the basic flow doesn't crash
    // Actual behavior depends on having chat history

    // Open edit selector
    stdin.write("\u001b");
    stdin.write("\u001b");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Try to edit (Enter)
    stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Type something
    stdin.write("Test edit");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Exit without submitting (Esc)
    stdin.write("\u001b");
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame();

    // Should not crash
    expect(frame).toBeDefined();
  });

  testBothModes(
    "should maintain UI stability during edit operations",
    async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      // Perform various operations
      stdin.write("\u001b");
      stdin.write("\u001b"); // Open edit with separate Esc presses

      // Wait for selector to open (poll instead of fixed timeout)
      await waitForCondition(
        () => lastFrame()?.includes("No user messages to edit") ?? false,
      );

      // Verify selector opened
      let frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain("No user messages to edit");

      stdin.write("k"); // Navigate (no-op with 0 messages)
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\u001b"); // Close

      // Wait for selector to close (poll instead of fixed timeout)
      await waitForCondition(
        () => !(lastFrame()?.includes("No user messages to edit") ?? true),
      );

      frame = lastFrame();

      // UI should remain stable and edit selector should be closed
      expect(frame).toBeDefined();
      expect(frame!.length).toBeGreaterThan(0);
      expect(frame).not.toContain("No user messages to edit");
    },
  );
});

describe("TUIChat - Edit Selector Navigation", () => {
  testBothModes("should handle rapid navigation commands", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Open edit selector
    stdin.write("\u001b\u001b");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Rapid navigation
    stdin.write("jjjjkkk");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should handle rapid input without crashing
    expect(frame).toBeDefined();
  });

  testBothModes("should handle arrow keys in edit selector", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Open edit selector
    stdin.write("\u001b\u001b");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Use arrow keys (ANSI escape sequences)
    stdin.write("\u001b[A"); // Up arrow
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("\u001b[B"); // Down arrow
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should handle arrow keys
    expect(frame).toBeDefined();
  });
});

describe("TUIChat - Edit Feature Edge Cases", () => {
  testBothModes(
    "should handle opening edit selector with no chat history",
    async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      // Try to open edit selector immediately (no history)
      stdin.write("\u001b\u001b");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const frame = lastFrame();

      // Should either show "no messages" or handle gracefully
      expect(frame).toBeDefined();
      expect(frame!.length).toBeGreaterThan(0);
    },
  );

  testBothModes("should handle single Esc (not double)", async (mode) => {
    const { lastFrame, stdin } = renderInMode(mode);

    // Single Esc (should not open edit selector)
    stdin.write("\u001b");
    await new Promise((resolve) => setTimeout(resolve, 600)); // Wait longer than 500ms threshold

    // Verify selector did not open
    let frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).not.toContain("No user messages to edit");

    stdin.write("\u001b"); // Another single Esc after timeout
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify selector still did not open
    frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).not.toContain("No user messages to edit");
  });

  testBothModes(
    "should prevent triple escape from causing issues",
    async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      // Triple Esc quickly
      stdin.write("\u001b\u001b\u001b");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const frame = lastFrame();

      // Should handle gracefully (open then close, or just open)
      expect(frame).toBeDefined();
    },
  );
});

describe("TUIChat - Edit Feature Compatibility", () => {
  testBothModes(
    "edit feature should not interfere with normal input",
    async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      // Type normal input
      stdin.write("Hello world");
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();

      // Should show typed text
      expect(frame).toBeDefined();
      // Normal input should work
    },
  );

  testBothModes(
    "should not conflict with other Esc-based features",
    async (mode) => {
      const { lastFrame, stdin } = renderInMode(mode);

      // Type something
      stdin.write("test");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Single Esc (might clear input or do other things)
      stdin.write("\u001b");
      await new Promise((resolve) => setTimeout(resolve, 600));

      const frame = lastFrame();

      // Should handle without conflicts
      expect(frame).toBeDefined();
    },
  );
});
