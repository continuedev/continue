import { render } from "ink-testing-library";
import React from "react";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

describe("TUIChat - Basic UI Tests", () => {
  let context: any;

  beforeEach(() => {
    context = createUITestContext({
      allServicesReady: true,
      serviceState: "ready",
      serviceValue: { some: "data" },
    });
  });

  afterEach(() => {
    context.cleanup();
  });

  it("renders without crashing", () => {
    const { lastFrame } = render(React.createElement(TUIChat));
    const frame = lastFrame();

    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);
  });

  it("shows loading state when services are loading", () => {
    // Override for this test
    context.mockUseServices.mockReturnValue({
      services: {},
      loading: true,
      error: null,
      allReady: false,
    });

    const { lastFrame } = render(React.createElement(TUIChat));
    const frame = lastFrame();

    expect(frame).toBeDefined();
    expect(frame).toMatch(/loading|service/i);
  });

  it("handles remote URL prop", () => {
    const { lastFrame } = render(
      React.createElement(TUIChat, { remoteUrl: "http://localhost:3000" })
    );
    const frame = lastFrame();

    expect(frame).toBeDefined();
    expect(frame.length).toBeGreaterThan(0);
  });
});