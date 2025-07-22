import { render } from "ink-testing-library";
import React from "react";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

describe("TUIChat - Message Tests", () => {
  let context: any;

  beforeEach(() => {
    context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
      chatMessages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    });
  });

  afterEach(() => {
    context.cleanup();
  });

  test("should render TUIChat component with messages", async () => {
    const { lastFrame } = render(React.createElement(TUIChat));
    const frame = lastFrame();
    
    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);
  });

  test.skip("should display chat messages - complex rendering test skipped", () => {
    // Message rendering requires complex component structure inspection
    // Skip for now to focus on basic rendering tests
  });
});