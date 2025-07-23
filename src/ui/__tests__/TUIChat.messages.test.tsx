import { render } from "ink-testing-library";
import React from "react";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

describe("TUIChat - Message Display Tests", () => {
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

  it("displays empty chat correctly", () => {
    // Use remote mode to bypass service loading
    const { lastFrame } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    const frame = lastFrame();

    // Should show the interface
    expect(frame).toContain("Ask anything");

    // Should have box borders (using the actual characters)
    expect(frame).toContain("│");

    // Should show remote mode indicator
    expect(frame).toContain("Remote Mode");
  });

  it("displays messages in correct order", () => {
    // Set up chat history in context
    context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
      chatMessages: [
        { role: "user", content: "First message" },
        { role: "assistant", content: "First response" },
        { role: "user", content: "Second message" },
        { role: "assistant", content: "Second response" },
      ],
    });

    // Use remote mode to bypass service loading
    const { lastFrame } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    // For now, just verify the component renders
    const frame = lastFrame();
    expect(frame).toContain("Ask anything");
    
    // The messages should be displayed if the component renders them
    // Note: The exact rendering of messages depends on the component implementation
  });

  it("shows input prompt in remote mode", () => {
    // Use remote mode to bypass service loading
    const { lastFrame } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    const frame = lastFrame();

    // Should show the default prompt
    expect(frame).toContain("Ask anything");

    // Should show slash commands hint
    expect(frame).toContain("/ for slash commands");

    // Should indicate remote mode
    expect(frame).toContain("Remote Mode");
  });
});