import { render } from "ink-testing-library";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  TipsDisplay,
  shouldShowTip,
  CONTINUE_CLI_TIPS,
} from "./TipsDisplay.js";

describe("TipsDisplay", () => {
  beforeEach(() => {
    // Mock Math.random to make tests deterministic
    vi.spyOn(Math, "random");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a random tip from the tips array", () => {
    // Mock Math.random to return 0.5, which should select the middle tip
    vi.mocked(Math.random).mockReturnValue(0.5);

    const expectedTipIndex = Math.floor(0.5 * CONTINUE_CLI_TIPS.length);
    const expectedTip = CONTINUE_CLI_TIPS[expectedTipIndex];

    const { lastFrame } = render(<TipsDisplay />);

    expect(lastFrame()).toContain("* Tip:");
    expect(lastFrame()).toContain(expectedTip);
  });

  it("renders different tips based on random selection", () => {
    // Test with first tip
    vi.mocked(Math.random).mockReturnValue(0.0);
    const { lastFrame: firstFrame } = render(<TipsDisplay />);
    expect(firstFrame()).toContain(CONTINUE_CLI_TIPS[0]);

    // Test with last tip - use partial match due to line wrapping
    vi.mocked(Math.random).mockReturnValue(0.99);
    const { lastFrame: lastFrame } = render(<TipsDisplay />);
    const lastTip = CONTINUE_CLI_TIPS[CONTINUE_CLI_TIPS.length - 1];
    const firstPartOfLastTip = lastTip.substring(0, 30); // Check first 30 chars
    expect(lastFrame()).toContain(firstPartOfLastTip);
  });

  it("always renders the tip structure correctly", () => {
    vi.mocked(Math.random).mockReturnValue(0.5);

    const { lastFrame } = render(<TipsDisplay />);
    const output = lastFrame();

    // Should contain the tip icon and label
    expect(output).toContain("* Tip:");

    // Should contain one of the tips
    const containsAtLeastOneTip = CONTINUE_CLI_TIPS.some(
      (tip) => output?.includes(tip) ?? false,
    );
    expect(containsAtLeastOneTip).toBe(true);
  });
});

describe("shouldShowTip", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when random value is less than 0.2 (20%)", () => {
    vi.mocked(Math.random).mockReturnValue(0.1);
    expect(shouldShowTip()).toBe(true);

    vi.mocked(Math.random).mockReturnValue(0.19);
    expect(shouldShowTip()).toBe(true);
  });

  it("returns false when random value is 0.2 or greater", () => {
    vi.mocked(Math.random).mockReturnValue(0.2);
    expect(shouldShowTip()).toBe(false);

    vi.mocked(Math.random).mockReturnValue(0.5);
    expect(shouldShowTip()).toBe(false);

    vi.mocked(Math.random).mockReturnValue(0.99);
    expect(shouldShowTip()).toBe(false);
  });

  it("has approximately 20% probability over many calls", () => {
    // Restore original Math.random for this statistical test
    vi.restoreAllMocks();

    // Test the probability distribution over many calls
    let trueCount = 0;
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      if (shouldShowTip()) {
        trueCount++;
      }
    }

    const probability = trueCount / iterations;
    // Allow for some variance (15% to 25% range)
    expect(probability).toBeGreaterThan(0.15);
    expect(probability).toBeLessThan(0.25);

    // Re-mock for proper cleanup
    vi.spyOn(Math, "random");
  });
});

describe("CONTINUE_CLI_TIPS", () => {
  it("contains at least 6 tips", () => {
    expect(CONTINUE_CLI_TIPS.length).toBeGreaterThanOrEqual(6);
  });

  it("all tips are non-empty strings", () => {
    CONTINUE_CLI_TIPS.forEach((tip, index) => {
      expect(typeof tip).toBe("string");
      expect(tip.trim().length).toBeGreaterThan(0);
    });
  });

  it("tips are helpful and informative", () => {
    // Check that tips contain useful keywords
    const usefulKeywords = [
      "/help",
      "escape",
      "pause",
      "arrow keys",
      "multi-line",
      "history",
      "/resume",
      "headless",
      "flag",
      "keyboard shortcuts",
    ];

    const allTipsText = CONTINUE_CLI_TIPS.join(" ").toLowerCase();

    // At least half of the keywords should appear in the tips
    const foundKeywords = usefulKeywords.filter((keyword) =>
      allTipsText.includes(keyword.toLowerCase()),
    );

    expect(foundKeywords.length).toBeGreaterThanOrEqual(
      usefulKeywords.length / 2,
    );
  });
});
