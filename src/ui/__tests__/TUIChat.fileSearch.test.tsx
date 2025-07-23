import { render } from "ink-testing-library";
import React from "react";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

describe("TUIChat - @ File Search Tests", () => {
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

  it("shows @ character when user types @ in local mode", async () => {
    // Test local mode - file search should work
    const { lastFrame, stdin } = render(<TUIChat />);

    // Wait a bit for initial render
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Type the @ character to trigger file search
    stdin.write("@");

    // Wait longer for file search to initialize and display files
    await new Promise((resolve) => setTimeout(resolve, 200));

    const frame = lastFrame()!;

    // Should show @ character in input or show file search UI
    // The @ might be in the input line or in a file search UI
    const hasAtSymbol = frame.includes("@") || frame.includes("◉ @");
    expect(hasAtSymbol).toBe(true);
    
    // Should NOT show remote mode
    expect(frame).not.toContain("Remote Mode");
    
    // Should show local mode UI elements
    expect(frame).toContain("Continue CLI");
  });

  it("shows search text when user types after @ in local mode", async () => {
    // Test local mode
    const { lastFrame, stdin } = render(<TUIChat />);

    // Type @ followed by text to filter files
    stdin.write("@READ");

    // Wait for file search to filter and display results
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame()!;

    // Should show the typed text
    expect(frame).toContain("@READ");
    
    // Should be in local mode
    expect(frame).not.toContain("Remote Mode");
    
    // When typing after @, we're in file search mode
    // Should show file navigation hints
    expect(frame).toContain("Use ↑/↓ to navigate");
  });

  it("handles multiple @ characters in local mode", async () => {
    // Test local mode
    const { lastFrame, stdin } = render(<TUIChat />);

    // Type multiple @ characters
    stdin.write("@@test");

    // Wait for UI update
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame();

    // Should handle multiple @ without crashing
    expect(frame).toBeDefined();
    expect(frame).toContain("@@test");
    
    // Should be in local mode with all features
    expect(frame).toContain("Continue CLI");
  });

  it("handles @ character input without crashing in local mode", async () => {
    // Test local mode
    const { lastFrame, stdin } = render(<TUIChat />);

    // Type @ to trigger file search
    stdin.write("@");

    // Wait for potential async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame()!;

    // Should not crash and show something
    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);
    
    // When @ is typed, we're in file search mode
    // Should show file search UI with navigation hints
    expect(frame).toContain("Use ↑/↓ to navigate");
  });

  it("@ file search still works in remote mode", async () => {
    // Remote mode should still support file search
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    stdin.write("@test");

    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame();
    
    // Should show remote mode
    expect(frame).toContain("Remote Mode");
    
    // Should show the @ input
    expect(frame).toContain("@test");
  });
});