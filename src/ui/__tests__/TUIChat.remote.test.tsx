import { render } from "ink-testing-library";
import React from "react";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

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
    const { lastFrame } = render(
      <TUIChat remoteUrl="http://localhost:3000" />
    );
    const frame = lastFrame();
    
    expect(frame).toBeDefined();
    expect(frame).toContain("Remote Mode");
    expect(frame).toContain("Ask anything");
  });

  it("shows remote mode indicator", () => {
    const { lastFrame } = render(
      <TUIChat remoteUrl="http://localhost:3000" />
    );
    const frame = lastFrame();
    
    // Should show remote mode in the UI
    expect(frame).toContain("◉ Remote Mode");
  });

  it("does not show service loading in remote mode", () => {
    const { lastFrame } = render(
      <TUIChat remoteUrl="http://localhost:3000" />
    );
    const frame = lastFrame();
    
    // Should not show loading services message
    expect(frame).not.toContain("Loading services");
    
    // Should go directly to chat UI
    expect(frame).toContain("Ask anything");
  });

  it("handles different remote URLs", () => {
    const { lastFrame } = render(
      <TUIChat remoteUrl="https://api.example.com:8080" />
    );
    const frame = lastFrame();
    
    // Should still work with different URLs
    expect(frame).toBeDefined();
    expect(frame).toContain("Remote Mode");
  });

  it("shows slash commands in remote mode", async () => {
    const { lastFrame, stdin } = render(
      <TUIChat remoteUrl="http://localhost:3000" />
    );

    // Type / to see slash commands
    stdin.write("/");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();
    
    // Should show at least the /exit command in remote mode
    expect(frame).toContain("/exit");
    expect(frame).toContain("Exit the remote environment");
  });
});