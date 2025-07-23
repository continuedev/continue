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

  it("shows slash when user types /", async () => {
    // Use remote mode to bypass service loading
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    // Type / to trigger slash command
    stdin.write("/");

    // Wait a bit for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the slash character
    expect(frame).toContain("/");
  });

  it("filters slash commands when typing /log", async () => {
    // Use remote mode to bypass service loading
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    // Type /log to trigger slash command filtering
    stdin.write("/log");

    // Wait a bit for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the typed command
    expect(frame).toContain("/log");
    
    // UI should remain stable
    expect(frame).toContain("Remote Mode");
  });

  it("handles tab key after slash command", async () => {
    // Use remote mode to bypass service loading
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

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
    }
  });

  it("shows slash command menu when typing /", async () => {
    // Use remote mode to bypass service loading
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    // Type just /
    stdin.write("/");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the slash
    expect(frame).toContain("/");
    
    // Should show slash command menu
    expect(frame).toContain("/exit");
    expect(frame).toContain("Use ↑/↓ to navigate, Enter to select, Tab to complete");
  });
});