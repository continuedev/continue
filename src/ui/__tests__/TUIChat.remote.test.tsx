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

  test("should render TUIChat component with remote URL", async () => {
    const { lastFrame } = render(
      React.createElement(TUIChat, { remoteUrl: "http://localhost:3000" })
    );
    const frame = lastFrame();
    
    expect(frame).toBeDefined();
    if (frame) {
      expect(frame.length).toBeGreaterThan(0);
    }
  });

  test.skip("should connect to remote server - network test skipped", () => {
    // Remote server tests require mock HTTP servers
    // Skip for now to focus on basic rendering tests
  });
});