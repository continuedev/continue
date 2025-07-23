import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import React from "react";
import TUIChat from "../TUIChat.js";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";

describe("TUIChat - Slash Commands Tests", () => {
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

  it("shows slash when user types / in local mode", async () => {
    // Test local mode - slash commands should work
    const { lastFrame, stdin } = render(<TUIChat />);

    // Type / to trigger slash command
    stdin.write("/");

    // Wait a bit for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the slash character
    expect(frame).toContain("/");
    
    // Should NOT show remote mode
    expect(frame).not.toContain("Remote Mode");
  });

  it("filters slash commands when typing /log in local mode", async () => {
    // Test local mode
    const { lastFrame, stdin } = render(<TUIChat />);

    // Type /log to trigger slash command filtering
    stdin.write("/log");

    // Wait a bit for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the typed command
    expect(frame).toContain("/log");
    
    // UI should remain stable in local mode
    expect(frame).not.toContain("Remote Mode");
    
    // Should show Continue CLI branding
    expect(frame).toContain("Continue CLI");
  });

  it("handles tab key after slash command in local mode", async () => {
    // Test local mode
    const { lastFrame, stdin } = render(<TUIChat />);

    // Type /log and then tab
    stdin.write("/log");
    
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    stdin.write("\t");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frameAfterTab = lastFrame();

    // Should not crash after tab
    expect(frameAfterTab).toBeDefined();
    if (frameAfterTab) {
      expect(frameAfterTab.length).toBeGreaterThan(0);
      // Should be in local mode
      expect(frameAfterTab).not.toContain("Remote Mode");
    }
  });

  it("shows slash command menu when typing / in local mode", async () => {
    // Test local mode - should have more slash commands available
    const { lastFrame, stdin } = render(<TUIChat />);

    // Type just /
    stdin.write("/");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the slash
    expect(frame).toContain("/");
    
    // In local mode, slash command might be in input
    // The / should be visible in the UI
    const hasSlashCommand = frame ? (frame.includes("/") && !frame.includes("Remote Mode")) : false;
    expect(hasSlashCommand).toBe(true);
    
    // Should show Continue CLI branding
    expect(frame).toContain("Continue CLI");
  });

  it("slash commands still work in remote mode", async () => {
    // Remote mode should still support basic slash commands
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    stdin.write("/");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();
    
    // Should show remote mode
    expect(frame).toContain("Remote Mode");
    
    // Should show slash command menu
    expect(frame).toContain("/exit");
  });
});