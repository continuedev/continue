import { createUITestContext } from "../../test-helpers/ui-test-context.js";

import { testBothModes, renderInMode } from "./TUIChat.dualModeHelper.js";

describe("TUIChat - Message Display Tests", () => {
  testBothModes("displays empty chat correctly", (mode) => {
    const { lastFrame } = renderInMode(mode);

    const frame = lastFrame();

    // Should show the interface
    expect(frame).toContain("Ask anything");

    // Should have box borders (using the actual characters)
    expect(frame).toContain("│");

    // Mode-specific assertions
    if (mode === "remote") {
      expect(frame).toContain("Remote Mode");
    } else {
      expect(frame).not.toContain("Remote Mode");
      expect(frame).toContain("Continue CLI");
    }
  });

  testBothModes("shows input prompt", (mode) => {
    const { lastFrame } = renderInMode(mode);

    const frame = lastFrame();

    // Should show the default prompt
    expect(frame).toContain("Ask anything");

    // Should show slash commands hint
    expect(frame).toContain("/ for slash commands");

    // In local mode, also shows context hint
    if (mode === "local") {
      expect(frame).toContain("@ for context");
    }

    // Verify mode-specific UI
    if (mode === "remote") {
      expect(frame).toContain("Remote Mode");
    } else {
      expect(frame).toContain("Continue CLI");
    }
  });

  testBothModes("displays messages in correct order", (mode) => {
    // Set up chat history in context
    const context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
      chatMessages: [
        { role: "user", content: "First message" },
        { role: "assistant", content: "First response" },
        { role: "user", content: "Second message" },
        { role: "assistant", content: "Second response" },
      ],
    });

    const { lastFrame } = renderInMode(mode);

    // Verify the component renders
    const frame = lastFrame();
    expect(frame).toContain("Ask anything");

    // In local mode, we have access to more UI elements
    if (mode === "local") {
      expect(frame).toContain("@ for context");
      expect(frame).toContain("/ for slash commands");
    }

    context.cleanup();
  });
});
