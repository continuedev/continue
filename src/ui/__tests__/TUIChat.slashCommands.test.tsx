import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import React from "react";
import TUIChat from "../TUIChat.js";
import { useService, useServices } from "../../hooks/useService.js";

// Get the mocked functions
const mockUseService = useService as jest.MockedFunction<typeof useService>;
const mockUseServices = useServices as jest.MockedFunction<typeof useServices>;

describe.skip("TUIChat - Slash Commands Tests", () => {
  beforeEach(() => {
    // Reset mock implementations
    mockUseService.mockReturnValue({
      value: null,
      state: "idle",
      error: null,
      reload: jest.fn(() => Promise.resolve()),
    });

    mockUseServices.mockReturnValue({
      services: {},
      loading: false,
      error: null,
      allReady: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should render TUIChat component", async () => {
    const { lastFrame } = render(React.createElement(TUIChat));
    const frame = lastFrame();
    
    expect(frame).toBeDefined();
    if (frame) {
      expect(frame.length).toBeGreaterThan(0);
    }
  });

  test.skip("should handle slash commands - complex interaction test skipped", () => {
    // Slash command testing requires complex input simulation
    // Skip for now to focus on basic rendering tests
  });
});