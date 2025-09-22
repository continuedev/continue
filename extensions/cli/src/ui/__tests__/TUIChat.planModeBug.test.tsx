import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAllTools } from "src/stream/handleToolCalls.js";

import { SERVICE_NAMES, serviceContainer } from "../../services/index.js";
import { modeService } from "../../services/ModeService.js";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import { AppRoot } from "../AppRoot.js";

describe("TUIChat - Plan Mode Bug Reproduction", () => {
  let context: any;

  beforeEach(async () => {
    context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
      serviceValue: { some: "data" },
    });

    // Ensure mode service is properly initialized in normal mode
    await modeService.initialize({});
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

  it.skip("reproduces the 'ToolPermissionService not initialized' error when switching modes", async () => {
    // This test specifically tests the service container interaction
    // that causes the actual bug in production

    // First, set up a realistic service state (not mocked)
    await modeService.initialize({ isHeadless: false });

    // Register the tool permissions service like the real app does
    const initialState = modeService.getToolPermissionService().getState();
    serviceContainer.registerValue(
      SERVICE_NAMES.TOOL_PERMISSIONS,
      initialState,
    );

    // Verify initial state works
    expect(() => getAllTools()).not.toThrow();

    // Switch modes WITHOUT updating the service container (this simulates the bug)
    modeService.switchMode("plan");

    // The service container still has the old state, so getAllTools() should not find
    // the updated state with plan mode permissions. However, since the ToolPermissionService
    // overrides isReady() to always return true, getAllTools() will actually work.
    // The real bug would manifest when the service container has an out-of-sync state.

    // To reproduce the ACTUAL bug, we need to simulate the case where the service
    // container has a stale state that doesn't match the ToolPermissionService
    const staleState = { ...initialState, currentMode: "normal" as const };
    serviceContainer.set(SERVICE_NAMES.TOOL_PERMISSIONS, staleState);

    // Now getAllTools() should work because it gets the service state from the container
    // and the container has a valid state (even if it's stale)
    const tools = getAllTools();
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);

    // But the tools returned will be for "normal" mode, not "plan" mode
    // In plan mode, many tools should be excluded, but with stale normal state, all tools are available
    const planModeState = modeService.getToolPermissionService().getState();
  });
});
