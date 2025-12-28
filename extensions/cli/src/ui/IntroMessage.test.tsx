import { Text } from "ink";
import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntroMessage } from "./IntroMessage.js";

// Mock the TipsDisplay module
vi.mock("./TipsDisplay.js", () => ({
  TipsDisplay: () => React.createElement(Text, null, "Mocked TipsDisplay"),
  shouldShowTip: vi.fn(),
}));

// Mock other dependencies
vi.mock("../asciiArt.js", () => ({
  getDisplayableAsciiArt: () => "MOCK ASCII ART",
}));

vi.mock("../utils/modelCapability.js", () => ({
  isModelCapable: () => true,
}));

describe("IntroMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders ASCII art and basic structure", () => {
    const { lastFrame } = render(<IntroMessage />);

    expect(lastFrame()).toContain("MOCK ASCII ART");
  });

  it("shows tips when shouldShowTip returns true", async () => {
    const { shouldShowTip } = await import("./TipsDisplay.js");
    vi.mocked(shouldShowTip).mockReturnValue(true);

    const { lastFrame } = render(<IntroMessage />);

    expect(lastFrame()).toContain("Mocked TipsDisplay");
  });

  it("does not show tips when shouldShowTip returns false", async () => {
    const { shouldShowTip } = await import("./TipsDisplay.js");
    vi.mocked(shouldShowTip).mockReturnValue(false);

    const { lastFrame } = render(<IntroMessage />);

    expect(lastFrame()).not.toContain("Mocked TipsDisplay");
  });

  it("renders config name when config is provided", () => {
    const config = { name: "Test Agent", version: "1.0.0", rules: [] };

    const { lastFrame } = render(<IntroMessage config={config} />);

    expect(lastFrame()).toContain("Config:");
    expect(lastFrame()).toContain("Test Agent");
  });

  it("renders model information when model is provided", () => {
    const model = {
      name: "provider/model-name",
      provider: "test-provider",
      model: "test-model",
    };

    const { lastFrame } = render(<IntroMessage model={model} />);

    expect(lastFrame()).toContain("Model:");
    expect(lastFrame()).toContain("model-name");
  });

  it("shows loading state when model is not provided", () => {
    const { lastFrame } = render(<IntroMessage />);

    expect(lastFrame()).toContain("Model:");
    expect(lastFrame()).toContain("Loading...");
  });

  it("renders organization name when provided", () => {
    const { lastFrame } = render(
      <IntroMessage organizationName="Test Organization" />,
    );

    expect(lastFrame()).toContain("Org:");
    expect(lastFrame()).toContain("Test Organization");
  });

  it("does not render organization section when not provided", () => {
    const { lastFrame } = render(<IntroMessage />);

    expect(lastFrame()).not.toContain("Org:");
  });
});
