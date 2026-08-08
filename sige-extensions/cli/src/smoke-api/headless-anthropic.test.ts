import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  createSmokeContext,
  cleanupSmokeContext,
  writeAnthropicConfig,
  runHeadless,
  type SmokeTestContext,
} from "./smoke-api-helpers.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!ANTHROPIC_API_KEY)(
  "Smoke: Headless → real Anthropic API",
  () => {
    let ctx: SmokeTestContext;

    beforeEach(async () => {
      ctx = await createSmokeContext();
      await writeAnthropicConfig(ctx, ANTHROPIC_API_KEY!);
    });

    afterEach(async () => {
      await cleanupSmokeContext(ctx);
    });

    it("should complete a round-trip and return a response", async () => {
      const result = await runHeadless(ctx, [
        "-p",
        "--config",
        ctx.configPath,
        "Reply with exactly the word 'hello' and nothing else.",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toContain("hello");
    });
  },
);
