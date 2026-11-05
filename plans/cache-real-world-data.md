# Cache behaviour in real agent traffic

What a week of production traffic from an enterprise Bedrock gateway says about prompt caching. It
informs C4 (default on for Claude) and the Auto lifetime in [`prompt-caching.md`](./prompt-caching.md).
Only ratios and percentages are published here: no dollar amounts or people counts.

The data is 274,070 model calls from 2026-10-26 to 2026-11-01 (UTC), made by coding agents (Claude Code,
Codex, pi, Cline, OpenCode) on Claude and OpenAI models through Bedrock, read from Bedrock's invocation
logs and checked against Cost Explorer. It is not Continue traffic.

## What caching did

- Cache reads were 93% of input tokens, cache writes 6%, fresh input under 1%.
- By spend, writes were 49% of the bill, reads 33%, output 12% and fresh input 5%.
- Re-pricing every input token at the plain input rate gives a bill 6.8 times larger: caching saved
  85% of the cost. A write costs 25% more than plain input and a read 90% less, so a write pays for itself
  after 0.26 later reads. The week measured 12 to 28 reads per written token.
- This holds token counts fixed, so it is an upper bound, and it covers tools that already set
  breakpoints.

## Gaps and misses

A gap is the time between two calls in one conversation, rebuilt from cache counts (the logs have no
session id). Most short gaps are tool-loop steps, not typed prompts.

| Gap before the call | Share of calls | Next call hit |
| ------------------- | -------------: | ------------: |
| under 30 s          |          78.1% |         98.9% |
| 30 s to 2 min       |          11.9% |         98.3% |
| 2 to 5 min          |           5.2% |         97.3% |
| 5 to 6 min          |           0.5% |         49.5% |
| 6 to 15 min         |           1.6% |         39.8% |
| 15 to 60 min        |           1.4% |         31.4% |
| over 1 h            |           1.4% |         24.4% |

- Gap percentiles: p50 10 s, p75 24 s, p90 122 s, p99 2.2 h.
- For Claude conversations that only ever wrote 5-minute entries the hit rate is 95% to 100% up to 299 s,
  45% for 300 to 314 s and 5% to 9% beyond 330 s. The boundary is 300 s between the two calls' timestamps,
  within about 10 s. Whether the cache counts from request start or response end could not be separated.
- Re-reading a prefix the cache lost cost about 39% of the input-side bill: 34 points after gaps of
  5 minutes or more, the rest from prompt edits, compaction and tool changes.
- A 1-hour entry works: after a 6 to 60 minute gap, calls hit 89% of the time when the previous call
  wrote 1 hour and 12% when it wrote 5 minutes. It falls off after 55 minutes.
- OpenAI models on Bedrock behave as a 30-minute lifetime (93% to 97% hits to 10 min, about 10% from 30 min).

## Replaying the same conversations under each lifetime

Claude conversations only (5,708 conversations, 181k calls), input-side cost at the billed rates, with
the share of the no-cache cost in brackets.

| Policy                                                 | Cost vs always 5 min | Share of no-cache cost |
| ------------------------------------------------------ | -------------------: | ---------------------: |
| Always 5 min                                           |             baseline |                  13.2% |
| Always 1 h                                             |               -18.3% |                  10.8% |
| Auto (escalate after one gap of 5 to 55 min)           |               -18.7% |                  10.7% |
| Auto, bound raised to 2 h or removed                   |      -18.8% / -18.7% |                  10.7% |
| Auto, escalate after two such gaps                     |               -17.1% |                  11.0% |
| Auto, escalate after three such gaps                   |               -15.6% |                  11.2% |
| Best of 5 min and 1 h per conversation, with hindsight |               -23.7% |                  10.1% |

- Auto is within 0.7 points of the hindsight bound, measured in share of the no-cache cost. Further
  tuning of the rule has little left to win. Section 6.3's 5 to 55 minute window is on the plateau:
  raising or removing the upper bound changes the total by under 0.2%, and waiting for a second long gap
  costs 1.6 points.
- The lifetime matters in long conversations. For 442 conversations of 100 or more calls (65% of the
  cost) 1 hour saves 27%; for single-call conversations 1 hour costs 60% more than 5 minutes, and Auto
  does not pay it.
- Auto is cheaper than 5 minutes for conversations of 10 or more calls, ties it on single calls, and
  costs 5% more on conversations of two to nine calls (the price of the first escalation).

## What this changes

| Item                                 | Before                          | After                                                                                                            |
| ------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Auto's thresholds (6.3)              | "From eight invented scenarios" | Checked on real conversations; the rule and its bounds are on the cost plateau. Keep them                        |
| Default lifetime                     | Auto (no data)                  | Keep Auto. A fixed 1 hour is within 0.6% of it but costs 60% more on single-call chats; 5 minutes costs 23% more |
| C4: caching on by default for Claude | Waiting for a week of data      | The data supports it for agent-style use. A bill-changing default still needs the owner (open decision)          |
| Keepalive pings                      | Deferred                        | Still deferred: 2.8% of calls follow a gap of 15 minutes or more, and Auto already covers them                   |
| The cache-miss notice (C6)           | Written from the docs           | Worth keeping: after gaps of 5 minutes or more, 50% to 76% of calls re-read the prefix                           |
| Price table                          | List prices                     | Bedrock `us.` profiles bill 1.10 times list; see below                                                           |

## Limits

- One week, one account, tools that already cache. Chat with long think times and Continue's own
  request shape are not represented, and real gaps there are probably longer.
- Conversations are rebuilt from cache counts and can merge or split. Compaction and pauses over a day
  start new chains, so long-gap miss counts are lower bounds. Two conversations from one person that
  share a prefix can be linked, which makes some misses look like hits.
- 40% of written tokens have no 5-minute/1-hour split (all OpenAI traffic, and Claude calls without an
  inline output body), so the "1 hour" and "5 minutes only" groups are the calls that reported one.
- The replay assumes a hit reads the whole previous context and ignores the 20-block lookback, partial
  reads after prompt edits, and output tokens.
- Model-call timestamps are call starts or ends; the boundary result is the gap between the two
  timestamps, and the logs cannot say which moment the cache counts from. A feature that depends on the
  exact moment (keepalive pings) would need a live test.

## Prices seen in the same data

Cost Explorer billed Claude models on Bedrock at 1.10 times Anthropic's list price on every component
(input, output, read, 5-minute write, 1-hour write) for the `us.` inference profiles. The pricing page
says regional and multi-region endpoints carry a 10% premium over global endpoints. The fork's table uses
list prices and so under-reports `us.` Bedrock costs by about 9%. Not yet applied: a global profile has
not been checked, and the right rule is per model ID prefix. Haiku 5.5 is billed at its higher
prompt-length rates on 97% of its tokens in this data.

## Making the lifetime adapt

Tested on the same conversations (Claude, input-side cost at billed rates). Today's Auto pays for its
lesson: the gap that makes it switch to 1 hour has already cost a full rewrite.

| Idea                                                                            |                                   Result against today's Auto |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------: |
| Learn each person's best of 5 min, 1 h and Auto from 3.5 weeks of their history | +0.2% (no gain); the same best option holds for 44% of people |
| Start on 1 hour for people whose past conversations often had a long gap        |                                                -0.5% to +0.2% |
| Best option per person, chosen with hindsight (an unreachable bound)            |                                                -1.8% to -2.8% |
| Best of 5 min and 1 h per conversation, with hindsight (an unreachable bound)   |                                                         -6.3% |
| Also escalate to 1 hour at the 5th request, whatever the gaps                   |                                     -3.8% (-3.4% at the 10th) |
| Also escalate when a conversation is 1 to 2 minutes old                         |                                                -3.9% to -4.1% |
| Also escalate once context passes 100k tokens                                   |                                                         -1.8% |
| Keepalive pings every 270 s after the last request                              |                        -1.3% at best, with 71k extra requests |

- Learning from a person's history does not pay: behaviour varies more between one person's conversations
  than between people, and even knowing the future gains 2% to 3%. Local history in Continue covers one
  person, so there is no population to learn from either.
- The conversation itself is the useful signal. Of conversations that reach 5 requests, 43% later pause 5
  to 55 minutes; of those reaching 50, 58%. Escalating at request 5 gives -2.9% to -4.4% for any threshold
  from 3 to 15 in each of four weeks, and captures about 60% of the per-conversation bound.
- It is not free: at request 5, 1,346 of 5,708 conversations pay less (about 60 cents each on average) and
  2,003 pay more (about 16 cents each, the 1-hour premium on writes never reused). Net -3.8%.
- The app today carries Auto's escalation into the next conversation. Replayed that way it costs 0.8% more
  than starting each conversation fresh and cancels the request-5 rule (+0.2% together). The build plan
  is in [`cache-adaptive-lifetime.md`](./cache-adaptive-lifetime.md).
- Caveats: the data is agent traffic, where a request is usually a tool step. In chat a request is a human
  turn, so the same threshold would fire later in wall-clock time. An age trigger is as good but behaves
  differently in chat, so count requests and check the mode.
