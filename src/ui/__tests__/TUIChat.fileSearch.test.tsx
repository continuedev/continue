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

  it("shows @ character when user types @", async () => {
    // Use remote mode to bypass service loading
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

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
    
    // Should still show the interface
    expect(frame).toContain("Remote Mode");
  });

  it("shows search text when user types after @", async () => {
    // Use remote mode to bypass service loading
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    // Type @ followed by text to filter files
    stdin.write("@READ");

    // Wait for file search to filter and display results
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame()!;

    // Should show the typed text
    expect(frame).toContain("@READ");
    
    // Should still be in remote mode
    expect(frame).toContain("Remote Mode");
  });

  it("handles multiple @ characters", async () => {
    // Use remote mode to bypass service loading
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    // Type multiple @ characters
    stdin.write("@@test");

    // Wait for UI update
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame();

    // Should handle multiple @ without crashing
    expect(frame).toBeDefined();
    expect(frame).toContain("@@test");
  });

  it("handles @ character input without crashing", async () => {
    // Use remote mode to bypass service loading
    const { lastFrame, stdin } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    // Type @ to trigger file search
    stdin.write("@");

    // Wait for potential async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame()!;

    // Should not crash and show something
    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);
  });
});