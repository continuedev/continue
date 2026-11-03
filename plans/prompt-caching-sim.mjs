// Cost model behind plans/prompt-caching.md section 5. Run: node plans/prompt-caching-sim.mjs
//
// Prices are multiples of the base input price (Anthropic list prices):
//   5m cache write 1.25x, 1h cache write 2x, cache read 0.1x.
// Simplifications: the whole prefix is cacheable, gaps are start-to-start
// seconds between consecutive requests, output tokens are ignored.

const WRITE_5M = 1.25;
const WRITE_1H = 2.0;
const READ = 0.1;
const PING_EVERY_S = 240;
const MAX_PINGS = 6;

/** Scenario: start context, per-request added tokens, gaps, and which gaps are tool waits. */
function scenario(
  name,
  n,
  gapS,
  addTokens,
  startTokens,
  overrides = {},
  toolGaps = [],
) {
  const gaps = Array(n).fill(gapS);
  for (const [i, v] of Object.entries(overrides)) gaps[Number(i)] = v;
  return {
    name,
    gaps,
    add: Array(n).fill(addTokens),
    start: startTokens,
    toolGaps: new Set(toolGaps),
  };
}

function cost(sc, policy) {
  let ctx = sc.start;
  let total = 0;
  let cached = false;
  let prevTtl = 300;
  let escalated = false;
  for (let k = 0; k < sc.gaps.length; k++) {
    const gap = sc.gaps[k];
    const add = sc.add[k];
    if (policy === "none") {
      total += ctx + add;
      ctx += add;
      continue;
    }
    // "escalate" starts at 5m and moves to 1h once a 5m cache has expired inside a
    // gap that 1h would have covered (more than 5 min, at most 55 min).
    if (policy === "escalate" && k > 0 && gap > 300 && gap <= 3300)
      escalated = true;
    const ttl =
      policy === "1h" || (policy === "escalate" && escalated) ? 3600 : 300;
    const write = ttl === 3600 ? WRITE_1H : WRITE_5M;
    let alive = k > 0 && cached && gap <= prevTtl;
    if (
      !alive &&
      policy === "5m+keepalive" &&
      k > 0 &&
      cached &&
      sc.toolGaps.has(k)
    ) {
      const pings = Math.ceil(gap / PING_EVERY_S) - 1;
      if (pings <= MAX_PINGS) {
        alive = true;
        total += pings * READ * ctx;
      }
    }
    total += alive ? READ * ctx + write * add : write * (ctx + add);
    ctx += add;
    cached = true;
    prevTtl = ttl;
  }
  return total;
}

const MIN = 60;
const scenarios = [
  scenario("Flow state: 60 requests, 25 s apart", 60, 25, 2000, 20000),
  scenario(
    "Flow state plus an 11 min and an 8 min command",
    60,
    25,
    2000,
    20000,
    { 30: 11 * MIN, 45: 8 * MIN },
    [30, 45],
  ),
  scenario(
    "Every 5th request follows a 10 min command (40 requests)",
    40,
    25,
    2000,
    20000,
    Object.fromEntries(
      [4, 9, 14, 19, 24, 29, 34, 39].map((i) => [i, 10 * MIN]),
    ),
    [4, 9, 14, 19, 24, 29, 34, 39],
  ),
  scenario("One 45 min break near the end", 60, 25, 2000, 20000, {
    50: 45 * MIN,
  }),
  scenario("Resumed the next morning (10 h)", 60, 25, 2000, 20000, {
    50: 10 * 60 * MIN,
  }),
  {
    ...scenario(
      "Chat with 1-40 min of think time (20 turns)",
      20,
      0,
      1500,
      8000,
    ),
    gaps: [0, 1, 2, 7, 3, 12, 1, 2, 25, 4, 2, 9, 1, 3, 6, 2, 40, 2, 1, 3].map(
      (m) => m * MIN,
    ),
  },
  scenario(
    "Chat, every reply read for 20 min before the next (20 turns)",
    20,
    20 * MIN,
    1500,
    8000,
  ),
  scenario("Single prompt, never followed up", 1, 0, 1500, 8000),
];

// Dollars assume $3 per million base input tokens (Claude Sonnet 4.6 list price).
const USD_PER_MTOK = 3;
const usd = (tokens) => ((tokens * USD_PER_MTOK) / 1e6).toFixed(2);

const policies = ["5m", "1h", "escalate", "5m+keepalive"];
console.log(["Scenario", "no cache", ...policies].join(" | "));
const worstVsBest = Object.fromEntries(policies.map((p) => [p, 0]));
const worstVsNone = Object.fromEntries(policies.map((p) => [p, 0]));
for (const sc of scenarios) {
  const base = cost(sc, "none");
  const costs = Object.fromEntries(policies.map((p) => [p, cost(sc, p)]));
  const best = Math.min(...Object.values(costs));
  for (const p of policies) {
    worstVsBest[p] = Math.max(worstVsBest[p], ((costs[p] - best) / base) * 100);
    worstVsNone[p] = Math.max(worstVsNone[p], (costs[p] / base) * 100);
  }
  const cells = policies.map(
    (p) => `$${usd(costs[p])} (${Math.round((costs[p] / base) * 100)}%)`,
  );
  console.log([sc.name, `$${usd(base)}`, ...cells].join(" | "));
}
const fmt = (o) => policies.map((p) => `${p} ${o[p].toFixed(0)}`).join(", ");
console.log("\nWorst bill as % of the no-cache bill: " + fmt(worstVsNone));
console.log(
  "Worst loss to the best policy, in points of the no-cache bill: " +
    fmt(worstVsBest),
);
const worstUsd = Object.fromEntries(policies.map((p) => [p, 0]));
for (const sc of scenarios) {
  const costs = Object.fromEntries(policies.map((p) => [p, cost(sc, p)]));
  const best = Math.min(...Object.values(costs));
  for (const p of policies)
    worstUsd[p] = Math.max(worstUsd[p], costs[p] - best);
}
console.log(
  "Worst loss to the best policy, in dollars: " +
    policies.map((p) => `${p} $${usd(worstUsd[p])}`).join(", "),
);
