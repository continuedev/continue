import type { Subprocess } from "execa";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  createSmokeContext,
  cleanupSmokeContext,
  writeAnthropicConfig,
  spawnServe,
  waitForPattern,
  sendMessageAndWait,
  getLastAssistantContent,
  shutdownServe,
  type SmokeTestContext,
} from "./smoke-api-helpers.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!ANTHROPIC_API_KEY)(
  "Smoke: Serve mode → real Anthropic API",
  () => {
    let ctx: SmokeTestContext;
    let proc: Subprocess;
    const port = 18321; // high port to avoid collisions
    const baseUrl = `http://127.0.0.1:${port}`;

    beforeEach(async () => {
      ctx = await createSmokeContext();
      await writeAnthropicConfig(ctx, ANTHROPIC_API_KEY!);
    });

    afterEach(async () => {
      if (proc) {
        await shutdownServe(proc, baseUrl);
      }
      await cleanupSmokeContext(ctx);
    });

    it("should accept a message via HTTP and return a response in state", async () => {
      proc = spawnServe(ctx, [
        "--port",
        String(port),
        "--config",
        ctx.configPath,
      ]);

      // Wait for the server to start
      await waitForPattern(proc, "Server started", 30000);

      // Send a message (retries with backoff on rate-limit errors)
      const state = await sendMessageAndWait(
        baseUrl,
        "Reply with exactly the word 'hello' and nothing else.",
      );

      const content = getLastAssistantContent(state);
      expect(content).toContain("hello");

      // Graceful exit
      const exitRes = await fetch(`${baseUrl}/exit`, { method: "POST" });
      expect(exitRes.ok).toBe(true);
    });
  },
);
