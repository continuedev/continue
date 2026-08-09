import type { Subprocess } from "execa";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  createSmokeContext,
  cleanupSmokeContext,
  writeAnthropicConfig,
  spawnServe,
  waitForPattern,
  pollUntilIdle,
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

      // Send a message
      const msgRes = await fetch(`${baseUrl}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Reply with exactly the word 'hello' and nothing else.",
        }),
      });
      expect(msgRes.ok).toBe(true);

      // Poll until the agent finishes processing
      const state = await pollUntilIdle(baseUrl, 60000);

      // State shape: { session: { history: ChatHistoryItem[] }, ... }
      // Each ChatHistoryItem has { message: { role, content }, ... }
      const history: any[] = state.session?.history ?? [];
      const assistantItems = history.filter(
        (item: any) => item.message?.role === "assistant",
      );
      expect(assistantItems.length).toBeGreaterThan(0);

      const lastMsg = assistantItems[assistantItems.length - 1].message;
      const content =
        typeof lastMsg.content === "string"
          ? lastMsg.content
          : lastMsg.content
              ?.filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("");

      expect(content?.toLowerCase()).toContain("hello");

      // Graceful exit
      const exitRes = await fetch(`${baseUrl}/exit`, { method: "POST" });
      expect(exitRes.ok).toBe(true);
    });
  },
);
