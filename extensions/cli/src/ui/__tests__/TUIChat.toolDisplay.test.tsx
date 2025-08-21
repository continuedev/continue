import { render } from "ink-testing-library";
import React from "react";

import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import { AppRoot } from "../AppRoot.js";

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
    const { lastFrame } = render(<AppRoot remoteUrl="http://localhost:3000" />);
    const frame = lastFrame();

    expect(frame).toBeDefined();
    expect(frame).toContain("Ask anything");
  });

  it("handles UI with no tools configured", () => {
    const { lastFrame } = render(<AppRoot remoteUrl="http://localhost:3000" />);
    const frame = lastFrame();

    // Should render normally even without tools
    expect(frame).toBeDefined();
    expect(frame).toContain("Remote Mode");
  });

  it("maintains UI stability during tool operations", async () => {
    const { lastFrame, stdin } = render(
      <AppRoot remoteUrl="http://localhost:3000" />,
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
      <AppRoot remoteUrl="http://localhost:3000" />,
    );

    // Wait for initial render
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Type / to see commands
    stdin.write("/");

    // Wait longer for slash command menu
    await new Promise((resolve) => setTimeout(resolve, 200));

    const frame = lastFrame();

    // Should show slash command character
    expect(frame).toContain("/");

    // The slash command menu might show different UI states
    // On Windows, the timing might be different
    const hasSlashCommandIndicator = frame
      ? frame.includes("↑/↓ to navigate") ||
        frame.includes("/exit") ||
        frame.includes("◉ /") ||
        frame.includes("/ for slash commands")
      : false;

    expect(hasSlashCommandIndicator).toBe(true);
  });
});
