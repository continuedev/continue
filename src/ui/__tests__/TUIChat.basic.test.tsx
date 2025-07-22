import { render } from "ink-testing-library";
import React from "react";
import TUIChat from "../TUIChat.js";

// Test TUIChat rendering without mocking services - just test it falls gracefully
describe("TUIChat - Basic UI Tests", () => {
  it("renders without crashing", () => {
    // This test just ensures the component can render without throwing
    const { lastFrame } = render(React.createElement(TUIChat));
    const frame = lastFrame();

    // Should render something even with error states
    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);
  });

  it("shows error state when services are not available", () => {
    const { lastFrame } = render(React.createElement(TUIChat));
    const frame = lastFrame();

    // Should show error or loading when services aren't mocked properly
    expect(frame).toBeDefined();
    expect(frame).toMatch(/error|loading|service|not|ctrl/i);
  });

  it("handles remote URL prop", () => {
    const { lastFrame } = render(
      React.createElement(TUIChat, { remoteUrl: "http://localhost:3000" })
    );
    const frame = lastFrame();

    // Should render something even with a remote URL
    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);
  });
});
