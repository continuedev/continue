import { describe, it } from "vitest";
import Bedrock from "./Bedrock";

/**
 * Live Bedrock measurement of prompt caching. Opt-in: set RUN_BEDROCK_LIVE=1
 * and have a Bedrock credential in the environment. Costs a few cents on Haiku
 * 4.5. Prints one "LIVE" line per request: tokens not cached, read from the
 * cache, and written (with the 5-minute / 1-hour split).
 *
 * Knobs: LIVE_MODEL, LIVE_TTL (5m|1h), LIVE_TURNS, and LIVE_WAIT_AFTER_TURN
 * with LIVE_WAIT_S to pause between two turns (to see an entry expire).
 */
const live = process.env.RUN_BEDROCK_LIVE === "1" ? describe : describe.skip;

const WORDS =
  "alpha beta gamma delta epsilon zeta theta iota kappa lambda sigma omega river stone cloud ember harbor lantern meadow orchard quartz saddle timber velvet willow yarrow zephyr bridge candle dragon engine forest garden hollow island jungle kettle ladder marble nectar oyster pillar quiver ribbon silver tunnel valley window anchor basket copper dagger falcon glacier hammer ivory jasmine knight lagoon mirror needle oasis pebble rocket spirit thunder umbrella voyage".split(
    " ",
  );

/** Deterministic varied text of about `chars` characters. */
function filler(seed: number, chars: number): string {
  let x = seed * 2654435761;
  let out = "";
  while (out.length < chars) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out += WORDS[x % WORDS.length] + " ";
  }
  return out;
}

live("Bedrock prompt caching (live)", () => {
  it("measures cache reads across a growing conversation", async () => {
    const model =
      process.env.LIVE_MODEL ?? "anthropic.claude-haiku-4-5-20251001-v1:0";
    const ttl = (process.env.LIVE_TTL as "5m" | "1h" | undefined) ?? "5m";
    const turns = Number(process.env.LIVE_TURNS ?? 4);
    const waitAfter = Number(process.env.LIVE_WAIT_AFTER_TURN ?? 0);
    const waitS = Number(process.env.LIVE_WAIT_S ?? 0);
    const bedrock = new Bedrock({
      model,
      region: process.env.AWS_REGION ?? "us-east-1",
      crossRegionInference: "auto",
    } as any);

    // A nonce makes this run's prefix unique, so earlier runs cannot hit. Set
    // LIVE_NONCE to share a prefix between two separate runs (isolation check).
    const nonce =
      process.env.LIVE_NONCE ??
      `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const system = `${nonce}. You answer in one short word. ${filler(1, 26000)}`;
    const messages: any[] = [{ role: "system", content: system }];

    for (let turn = 1; turn <= turns; turn++) {
      if (waitAfter > 0 && turn === waitAfter + 1 && waitS > 0) {
        console.log(`LIVE waiting ${waitS}s before turn ${turn}`);
        await new Promise((r) => setTimeout(r, waitS * 1000));
      }
      messages.push({
        role: "user",
        content: `Turn ${turn}. Reply with only the word OK. ${filler(10 + turn, 7000)}`,
      });
      let reply = "";
      let usage: any;
      for await (const chunk of bedrock.streamChat(
        messages,
        new AbortController().signal,
        {
          model,
          maxTokens: 16,
          promptCaching: true,
          promptCacheTtl: ttl,
        } as any,
      )) {
        if (chunk.role === "assistant") {
          if (typeof chunk.content === "string") reply += chunk.content;
          if (chunk.usage) usage = chunk.usage;
        }
      }
      const d = usage?.promptTokensDetails ?? {};
      console.log(
        `LIVE ttl=${ttl} turn=${turn} uncached=${usage?.promptTokens} read=${d.cachedTokens} write=${d.cacheWriteTokens} w5m=${d.cacheWriteTokens5m} w1h=${d.cacheWriteTokens1h}`,
      );
      messages.push({ role: "assistant", content: reply || "OK" });
    }
  }, 900_000);
});
