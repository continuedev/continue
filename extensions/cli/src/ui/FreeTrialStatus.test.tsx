import { render } from "ink-testing-library";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FreeTrialStatus } from "./FreeTrialStatus.js";

describe("FreeTrialStatus", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not fetch or poll for non-free-trial models", async () => {
    vi.useFakeTimers();
    const getFreeTrialStatus = vi.fn().mockResolvedValue({
      optedInToFreeTrial: true,
      chatCount: 1,
      chatLimit: 10,
    });

    render(
      <FreeTrialStatus
        apiClient={{ getFreeTrialStatus } as any}
        model={{ provider: "anthropic", model: "claude-sonnet-4-5" } as any}
      />,
    );

    await vi.runAllTimersAsync();

    expect(getFreeTrialStatus).not.toHaveBeenCalled();
  });

  it("fetches immediately and polls every five seconds for free-trial models", async () => {
    vi.useFakeTimers();
    process.env.NODE_ENV = "development";
    const getFreeTrialStatus = vi.fn().mockResolvedValue({
      optedInToFreeTrial: true,
      chatCount: 1,
      chatLimit: 10,
    });

    render(
      <FreeTrialStatus
        apiClient={{ getFreeTrialStatus } as any}
        model={{
          provider: "continue-proxy",
          model: "test-model",
          apiKeyLocation: "free_trial:test",
        } as any}
      />,
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(getFreeTrialStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(getFreeTrialStatus).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(10000);
    expect(getFreeTrialStatus).toHaveBeenCalledTimes(4);
  });
});
