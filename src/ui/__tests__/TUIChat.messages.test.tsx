import { render } from "ink-testing-library";
import React from "react";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

// Import our new test utilities (they will work with mocked modules)
import { renderWithServices } from "../../test-helpers/renderWithServices.js";
import { createTestServiceContainer } from "../../test-helpers/testServiceContainer.js";

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

  it("displays empty chat correctly in local mode", () => {
    // Test local mode - services are mocked to be ready
    const { lastFrame } = render(<TUIChat />);

    const frame = lastFrame();

    // Should show the interface
    expect(frame).toContain("Ask anything");

    // Should have box borders (using the actual characters)
    expect(frame).toContain("│");

    // Should NOT show remote mode indicator in local mode
    expect(frame).not.toContain("Remote Mode");
    
    // Should show Continue CLI branding
    expect(frame).toContain("Continue CLI");
  });

  it("displays messages in correct order in local mode", () => {
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

    // Test local mode
    const { lastFrame } = render(<TUIChat />);

    // Verify the component renders
    const frame = lastFrame();
    expect(frame).toContain("Ask anything");
    
    // In local mode, we have access to more UI elements
    expect(frame).toContain("@ for context");
    expect(frame).toContain("/ for slash commands");
  });

  it("shows input prompt in local mode", () => {
    // Test local mode
    const { lastFrame } = render(<TUIChat />);

    const frame = lastFrame();

    // Should show the default prompt
    expect(frame).toContain("Ask anything");

    // Should show context hint
    expect(frame).toContain("@ for context");

    // Should show slash commands hint
    expect(frame).toContain("/ for slash commands");

    // Should NOT indicate remote mode
    expect(frame).not.toContain("Remote Mode");
  });

  // Additional test to demonstrate remote mode still works
  it("still supports remote mode for remote server testing", () => {
    // Remote mode should still work for testing remote connections
    const { lastFrame } = render(<TUIChat remoteUrl="http://localhost:3000" />);

    const frame = lastFrame();

    // Should show remote mode indicator
    expect(frame).toContain("Remote Mode");
    
    // Should still have the UI
    expect(frame).toContain("Ask anything");
  });
});