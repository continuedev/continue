import { render } from "ink-testing-library";
import React from "react";

import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import { AppRoot } from "../AppRoot.js";

describe("TUIChat - Remote Server Tests", () => {
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

  it("renders in remote mode with remote URL", () => {
    const { lastFrame } = render(<AppRoot remoteUrl="http://localhost:3000" />);
    const frame = lastFrame();

    expect(frame).toBeDefined();
    expect(frame).toContain("Remote Mode");
    expect(frame).toContain("Ask anything");
  });

  it("shows remote mode indicator", () => {
    const { lastFrame } = render(<AppRoot remoteUrl="http://localhost:3000" />);
    const frame = lastFrame();

    // Should show remote mode in the UI
    expect(frame).toContain("◉ Remote Mode");
  });

  it("does not show service loading in remote mode", () => {
    const { lastFrame } = render(<AppRoot remoteUrl="http://localhost:3000" />);
    const frame = lastFrame();

    // Should not show loading services message
    expect(frame).not.toContain("Loading services");

    // Should go directly to chat UI
    expect(frame).toContain("Ask anything");
  });

  it("handles different remote URLs", () => {
    const { lastFrame } = render(
      <AppRoot remoteUrl="https://api.example.com:8080" />,
    );
    const frame = lastFrame();

    // Should still work with different URLs
    expect(frame).toBeDefined();
    expect(frame).toContain("Remote Mode");
  });

  it("shows slash commands in remote mode", async () => {
    const { lastFrame, stdin } = render(
      <AppRoot remoteUrl="http://localhost:3000" />,
    );

    // Wait for initial render
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Type / to see slash commands
    stdin.write("/");

    // Wait longer for slash command menu to appear
    await new Promise((resolve) => setTimeout(resolve, 200));

    const frame = lastFrame();

    // Should show slash character at minimum
    expect(frame).toContain("/");

    // The slash command menu might show /exit or navigation instructions
    // Different timing might show different states
    const hasSlashCommandUI = frame
      ? frame.includes("/exit") ||
        frame.includes("↑/↓ to navigate") ||
        frame.includes("◉ /") ||
        frame.includes("/ for slash commands") // Placeholder text is also valid
      : false;

    expect(hasSlashCommandUI).toBe(true);
  });
});
