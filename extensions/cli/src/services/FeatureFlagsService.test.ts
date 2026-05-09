import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("missing")),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

import { FeatureFlagsService } from "./FeatureFlagsService.js";

const FLAG_KEYS = [
  "TURN_LIFECYCLE_HOOKS",
  "TASK_NOTIFICATIONS",
  "CLI_STATUSLINE",
  "CLI_VIM_MODE",
  "SEMANTIC_MEMORY_SELECTION",
  "CACHED_MICROCOMPACTION",
] as const;

describe("FeatureFlagsService defaults", () => {
  const previousEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of FLAG_KEYS) {
      const envKey = `CONTINUE_FLAG_${key}`;
      previousEnv.set(envKey, process.env[envKey]);
      delete process.env[envKey];
    }
  });

  afterEach(() => {
    for (const [envKey, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = value;
      }
    }
    previousEnv.clear();
  });

  it("enables the graduated rollout defaults while keeping higher-risk flags opt-in", async () => {
    const service = new FeatureFlagsService();
    const state = await service.initialize();

    expect(state.flags.TURN_LIFECYCLE_HOOKS).toBe(true);
    expect(state.flags.TASK_NOTIFICATIONS).toBe(true);
    expect(state.flags.CLI_STATUSLINE).toBe(true);

    expect(state.flags.SEMANTIC_MEMORY_SELECTION).toBe(false);
    expect(state.flags.CLI_VIM_MODE).toBe(false);
    expect(state.flags.CACHED_MICROCOMPACTION).toBe(false);
  });
});
