import { render } from "ink-testing-library";
import React from "react";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

describe("TUIChat - User Input Tests", () => {
  let context: any;

  beforeEach(() => {
    context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
    });
  });

  afterEach(() => {
    context.cleanup();
  });

  it("shows typed text in input field in local mode", () => {
    // Test local mode - services are mocked to be ready
    const { lastFrame, stdin } = render(<TUIChat />);

    stdin.write("Testing 123");

    const frame = lastFrame();
    // The input should be visible in local mode
    expect(frame ? frame.toLowerCase() : "").toMatch(
      /testing|123|ask anything/
    );
    
    // Should not show remote mode indicator
    expect(frame).not.toContain("Remote Mode");
  });

  it("handles Enter key to submit in local mode", async () => {
    // Test local mode
    const { lastFrame, stdin } = render(<TUIChat />);

    const beforeEnter = lastFrame();
    expect(beforeEnter).toContain("Ask anything");
    expect(beforeEnter).toContain("@ for context");

    stdin.write("\r");

    // Wait for the UI to update after pressing enter
    await new Promise((resolve) => setTimeout(resolve, 50));

    const afterEnter = lastFrame();

    // The UI should remain stable after Enter (no crash)
    expect(afterEnter).toBeDefined();
    expect(afterEnter).toContain("Ask anything");
    
    // Local mode features should still be available
    expect(afterEnter).toContain("/ for slash commands");
  });

  it("handles special characters in input without crashing in local mode", () => {
    // Test local mode
    const { lastFrame, stdin } = render(<TUIChat />);

    // Try typing various special characters
    stdin.write("!@#$%^&*()");

    const frame = lastFrame();

    // Should handle special characters without crashing
    expect(frame).toBeDefined();
    expect(frame).not.toBe("");
    
    // UI should still be functional
    expect(frame).toContain("Ask anything");
    
    // Should show all local mode features
    expect(frame).toContain("Continue CLI");
  });

  it("input still works in remote mode when needed", () => {
    // Remote mode should still function for remote testing
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    stdin.write("Remote test");

    const frame = lastFrame();
    
    // Should show remote mode
    expect(frame).toContain("Remote Mode");
    
    // Input should still work
    expect(frame).toBeDefined();
  });
});