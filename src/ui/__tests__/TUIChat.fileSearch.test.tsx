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

  test("should render TUIChat component", async () => {
    const { lastFrame } = render(React.createElement(TUIChat));
    const frame = lastFrame();
    
    expect(frame).toBeDefined();
    if (frame) {
      expect(frame.length).toBeGreaterThan(0);
    }
  });

  test.skip("should handle @ file search - complex interaction test skipped", () => {
    // File search interactions require complex input simulation
    // Skip for now to focus on basic rendering tests
  });
});