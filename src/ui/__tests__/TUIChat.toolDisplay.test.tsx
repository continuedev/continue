import { render } from "ink-testing-library";
import React from "react";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

describe("TUIChat - Tool Display Tests", () => {
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

  it("renders without crashing when tools are available", () => {
    const { lastFrame } = render(
      <TUIChat remoteUrl="http://localhost:3000" />
    );
    const frame = lastFrame();
    
    expect(frame).toBeDefined();
    expect(frame).toContain("Ask anything");
  });

  it("handles UI with no tools configured", () => {
    const { lastFrame } = render(
      <TUIChat remoteUrl="http://localhost:3000" />
    );
    const frame = lastFrame();
    
    // Should render normally even without tools
    expect(frame).toBeDefined();
    expect(frame).toContain("Remote Mode");
  });

  it("maintains UI stability during tool operations", async () => {
    const { lastFrame, stdin } = render(
      <TUIChat remoteUrl="http://localhost:3000" />
    );

    // Type a message that might trigger tool use
    stdin.write("Use a tool to help me");
    
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    const frame = lastFrame();
    
    // UI should remain stable
    expect(frame).toBeDefined();
    if (frame) {
      expect(frame.length).toBeGreaterThan(0);
    }
  });

  it("shows tool-related slash commands", async () => {
    const { lastFrame, stdin } = render(
      <TUIChat remoteUrl="http://localhost:3000" />
    );

    // Type / to see commands
    stdin.write("/");
    
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    const frame = lastFrame();
    
    // Should show slash command menu
    expect(frame).toContain("/");
    expect(frame).toContain("Use ↑/↓ to navigate");
  });
});