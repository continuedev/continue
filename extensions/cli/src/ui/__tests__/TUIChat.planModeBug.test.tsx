import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { services } from "../../services/index.js";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import { AppRoot } from "../AppRoot.js";
const toolPermissionService = services.toolPermissions;
describe("TUIChat - Plan Mode Bug Reproduction", () => {
  let context: any;

  beforeEach(async () => {
    context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
      serviceValue: { some: "data" },
    });

    // Ensure mode service is properly initialized in normal mode
    await toolPermissionService.doInitialize({
      mode: "normal",
    });
  });

  afterEach(() => {
    context.cleanup();
  });

  it("a) start up b) shift+tab to plan c) [plan] visible d) send message", async () => {
    const { lastFrame, stdin, unmount } = render(React.createElement(AppRoot));

    try {
      // a) Start up
      let frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain("Ask anything");

      // b) Shift+Tab to switch into plan mode
      stdin.write("\x1b[Z");
      await new Promise((resolve) => setTimeout(resolve, 200));

      frame = lastFrame();

      // c) Make sure the string "[plan]" is on the screen
      expect(frame!).toContain("plan]");

      // d) Successfully send a message without error
      const testMessage = "Can you help me analyze this code?";
      stdin.write(testMessage);
      stdin.write("\r");

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 300));

      frame = lastFrame();

      // Verify no crash occurred and UI is still functional
      expect(frame).toBeDefined();
      expect(frame!.length).toBeGreaterThan(0);

      // Should still be in plan mode after sending message
      expect(frame!).toContain("plan]");

      // Should still show the input prompt
      expect(frame!).toContain("Ask anything");
    } finally {
      unmount();
    }
  });

  it("tests mode switching back and forth works correctly", async () => {
    const { lastFrame, stdin, unmount } = render(React.createElement(AppRoot));

    try {
      // Start in normal mode
      let frame = lastFrame();
      expect(frame!).not.toContain("plan]");
      expect(frame!).not.toContain("auto]");

      // Switch to plan mode
      stdin.write("\x1b[Z");
      await new Promise((resolve) => setTimeout(resolve, 100));

      frame = lastFrame();
      expect(frame!).toContain("plan]");

      // Switch to auto mode
      stdin.write("\x1b[Z");
      await new Promise((resolve) => setTimeout(resolve, 100));

      frame = lastFrame();
      expect(frame!).toContain("auto]");
      expect(frame!).not.toContain("plan]");

      // Switch back to normal mode
      stdin.write("\x1b[Z");
      await new Promise((resolve) => setTimeout(resolve, 100));

      frame = lastFrame();
      expect(frame!).not.toContain("plan]");
      expect(frame!).not.toContain("auto]");
    } finally {
      unmount();
    }
  });

  it("tests that you can switch modes after being in plan mode", async () => {
    const { lastFrame, stdin, unmount } = render(React.createElement(AppRoot));

    try {
      // Switch to plan mode
      stdin.write("\x1b[Z");
      await new Promise((resolve) => setTimeout(resolve, 100));

      let frame = lastFrame();
      expect(frame!).toContain("plan]");

      // Send a message while in plan mode
      stdin.write("Test message");
      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 200));

      frame = lastFrame();

      // Try to switch to another mode - this is where the bug might occur
      stdin.write("\x1b[Z]"); // Should go to auto mode
      await new Promise((resolve) => setTimeout(resolve, 200));

      frame = lastFrame();

      // This should work - if it fails, we've reproduced the "can't switch back" bug
      expect(frame!).toContain("auto]");
      expect(frame!).not.toContain("plan]");
    } finally {
      unmount();
    }
  });
});
