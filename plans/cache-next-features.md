# Plan: cache features from real-world data (C14 to C19)

Status: planned, nothing built. Written 2026-11-03 against `feat/cache-countdown`. Evidence:
[`cache-real-world-data.md`](./cache-real-world-data.md). The Auto lifetime changes (C11a to C13) are in
[`cache-adaptive-lifetime.md`](./cache-adaptive-lifetime.md) and are not repeated here.

## Summary

A week of real agent traffic says caching is worth far more than any lifetime tuning, and that the Auto
lifetime is already close to the best achievable. What is left is accuracy and reach: price the Bedrock
regional premium, show what lost caches cost, bring the policy to the CLI, and only then change the default.

Six features. C14 is small and independent. C17 is small and reuses the miss detector. C15 is a billing default
the owner decides. C16 and C18 each need a check before they can be sized. C19 needs Continue's own data
first, so it is a placeholder with a test, not a build.

## What the data supports

| Finding                                                     | Number                                                                                   | Feature                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Caching against no caching, same tokens                     | about 85% cheaper (upper bound)                                                          | C15, C16                                              |
| A write pays for itself after this many later reads         | about 0.3 (0.26 at the billed rates)                                                     | C15                                                   |
| Single-call conversations                                   | 20% of conversations, under 1% of cost                                                   | C15                                                   |
| Input-side cost spent re-reading prefixes the cache lost    | 39%, of which 34 points follow gaps of 5 minutes or more                                 | C17                                                   |
| Writes above a session's peak context, by session age       | 14% under 15 min, 84% for 4 to 24 h, 93% over 24 h                                       | C19                                                   |
| Claude on Bedrock `us.` profiles, billed against list price | 1.10 times, on every component                                                           | C14                                                   |
| OpenAI models on Bedrock: hit rate by gap                   | 93% to 97% to 10 min, 77% to 83% at 20 to 30 min, about 10% from 30 min                  | C18                                                   |
| A tool with a poor request shape                            | 15% of input uncached, about twice the input cost of the same traffic at the typical mix | none; C13 shows whether Continue has the same problem |
| Hit rate inside the lifetime                                | 98.6% to 99.1% in each of four weeks                                                     | no work                                               |
| Per-person tuning from history; keepalive pings             | +0.2%; -1.3% at best                                                                     | not building                                          |

## Features

### C14: Bedrock regional price factor

Claude models on Bedrock `us.` inference profiles were billed at 1.10 times Anthropic's list price on
input, output, cache reads and both write lifetimes. The cost table uses list prices, so every dollar
figure the app shows for those models, including the notices, is about 9% low. Anthropic documents the
rule: "Regional and multi-region endpoints include a 10 percent premium over global endpoints", for Claude
Sonnet 4.5, Haiku 4.5, Opus 4.5 and all later models, and "earlier models retain their existing pricing"
(platform.claude.com/docs/en/about-claude/pricing, read 2026-11-04).

- `calculateRequestCost(provider, model, usage)` calls `calculateAnthropicCost`, which calls
  `findAnthropicPricing`, which calls `normalizeClaudeModelId`. That function drops everything before
  `claude`, so the prefix is gone before the price lookup. Read the prefix first, then normalise.
- Factor 1.10 for the geographic prefixes `us.`, `eu.`, `apac.`, `jp.`, `au.` and `ca.` on those models;
  1.0 for `global.`, for `us-gov.` (GovCloud is priced separately), for IDs with no prefix and for earlier
  models. Applies to every component, including Haiku 5.5's higher price above 100,000 tokens.
- The Bedrock provider also prefixes a bare model ID at request time from `env.crossRegionInference`
  (`applyCrossRegionInference`). The factor needs the prefix in the configured ID; a bare one stays at list.
- Tooltips that quote a figure say when the factor was applied. The existing "estimated" label stays.
- Evidence: only `us.` was seen in billing data. The other prefixes follow the vendor's statement. The AWS
  Bedrock price table is rendered by script and could not be read, so no per-model figure was checked there.
- Tests: table-driven by prefix and model; each component; the long tier; the shared table is not changed.
- Risk: low. Depends on: nothing.
- Built on `feat/bedrock-us-price-factor` (`10a7ee46f`, then `f462f7286` and `823e77f98` for the other
  prefixes and the docs, in the fork, stacked on the countdown branch). `findAnthropicPricing` applies the
  factor, so the notices and the usage panel get it. The breakdown says when it was applied. Not checked in a
  running UI.

### C15: caching on by default in agent-style modes

C4 is a billing default and the owner's decision. The data supports a narrower version than "on for all
Claude use": on in Agent, Plan and Background when the config says nothing; Chat unchanged.

- Why not Chat: the first write costs 25% more than plain input and pays for itself on the first later
  request that reads it (break-even 0.26 of a read). A tool loop makes that second request nearly certain. A
  one-shot chat question never makes it, and no data here says how often chat users follow up.
- An explicit `promptCaching: false` in config stays off. An explicit toolbar choice wins over everything.
- `resolvePromptCache` computes `cachingOn` from the toolbar setting or `configEnablesPromptCaching`. With
  no setting and no config, return `promptCaching: true` plus the Auto lifetime when `mode` is agent-style.
  `promptCacheStatus` must agree, or the toolbar icon and the request will disagree.
- The caching-off notice (`CachingOffNotice`) currently fires on a long conversation with caching off. With
  the default, it only shows in Chat or when the user turned caching off. Check its tests.
- Docs: `prompt-caching.mdx` lists "Caching on by default" under "Not supported". Change it.
- Release note says the first request of a session costs more, and where the switch is.
- Tests: the mode matrix against setting and config; the status and the request option agree; the notice.
- Risk: medium (billing). Depends on: C11a, C11b, and a week of C13 data from Continue's own Agent use.

### C16: the CLI and the shared adapters

Checked in the code on `feat/cache-countdown`; nothing run.

- The CLI builds its model client with `constructLlmApi` from `packages/openai-adapters`, which does not
  import `core`. The GUI path (`core/llm/llms/Anthropic.ts`, `Bedrock.ts`) is a different implementation.
  Everything in C2 to C13 is in `core` and the GUI, so none of it reaches the CLI.
- Anthropic adapter: caching is on unless `cachingStrategy` is `none`. The default strategy
  (`systemAndTools`) marks the system prompt, the tools and the last two user messages with
  `cache_control: { type: "ephemeral" }`. No `ttl` is ever sent, so the CLI is always on the 5-minute lifetime.
- Bedrock adapter (`BedrockApi`): the cache points are commented out (`_addCachingToLastTwoUserMessages` is
  never called, and the system block is `false ? ... : ...`). It sends no cache points at all. A CLI user on
  Bedrock gets no prompt caching, and `cacheBehavior` is not in the adapter's Bedrock schema (also commented out).
- The Bedrock adapter reads no usage at all. A search of `Bedrock.ts` for `usage`, `metadata`, `inputTokens`
  and the cache token fields finds only `usage: undefined` in the non-streaming reply and the embedding and
  rerank replies. The Converse stream's `metadata` event, which carries the token counts and the cache read
  and write counts, is never handled. So a CLI session on Bedrock cannot show tokens, cost or cache hits, and
  `streamChatResponse.helpers.ts` falls back to its estimate. That is a code reading; it was not run.

Before sizing: the live run is still worth a few cents, but it can now only confirm what the code says: no
cache points go out and no usage comes back. If so, this is the largest finding in the plan. The data says
caching saves about 85% of input-side cost, and a Bedrock CLI session gets none of it and cannot even see it.

Proposed, in this order, each its own PR:

1. **Done** (`feat/bedrock-adapter-usage`, `347d17f6c`, local, branched from the countdown commit). The Bedrock adapter handles the stream's `metadata` event and maps token counts and cache read and write
   counts into `usage`. This comes first: without it nothing else in the CLI can be measured or priced.
2. **Built and checked live** (`feat/bedrock-adapter-usage`, `4efb659d2`, local). The Bedrock adapter sends `cachePoint` on the system block, the tools and the last two user messages,
   behind the same `promptCaching` setting the GUI honours, defaulting off until the live test passes.
3. Both adapters accept a lifetime (`5m` or `1h`) and send it as `ttl`. `core` already has the Bedrock
   allowlist (`bedrockSupportsOneHourCache`); the adapters cannot import `core`, so move it somewhere both can.
4. The CLI applies the Auto rule (C11a and C11b) from its own request count and the gap between requests.
   The CLI has no toolbar, so the setting comes from config and a flag.

Step 2 as built: the adapter reads `promptCaching` and `cacheBehavior` from its config and uses the same rules as `core` (`promptCaching: false` wins; `true` caches tools, system and the last two user messages; nothing set sends no cache points). The CLI passes them from the model config (`defaultCompletionOptions.promptCaching`, `cacheBehavior`). The process ID goes on the first user message only, as in `core`. Not done: no `ttl` is sent (step 3).

Live check (2026-11-04, Haiku 4.5 on a `us.` profile, a prompt of about 11,400 tokens with one tool, three non-streaming requests through the built adapter): with caching off the usage came back with about 11,400 uncached prompt tokens on every request and zero cache tokens, so step 1 works. With `promptCaching: true` request 1 wrote 11,414 tokens, request 2 read 11,414 and wrote 16, and request 3 read 11,430 and wrote 17, with 3 uncached prompt tokens each time. So caching works without the `x-amzn-bedrock-enablepromptcaching` header that `core` sets; the adapter does not need it. Not checked: streaming, a real tool loop with tool results, a 1-hour lifetime (no `ttl` is sent yet, step 3), and the CLI itself end to end.

Tests: request-body tests in the adapters (there is a `Bedrock.vitest.ts`), the shared allowlist, and a CLI
test with a mocked client. Live: a few cents on Bedrock, as for the GUI.
Risk: low for step 1 (reads a field that is already sent); medium for step 2 (turns on billing behaviour for
CLI Bedrock users); low for step 3.
Depends on: the live check above.

### C17: show what lost caches cost

C10 asked for a "spent on cold rewrites" line in the usage panel. The data gives it a definition.

- Re-read cost of a request = tokens the previous request cached but this one did not read, times the
  5-minute write price minus the read price. Over a week of all requests this was 39% of input-side cost: 34
  points after a gap of 5 minutes or more and 5 points from prompt edits, compaction and tool changes. Show
  the two parts separately.
- `detectCacheMiss` and the session's `lastInputTokens` already give the lost prefix per request. The usage
  panel (`TotalUsage.tsx`) already shows cache read, cache write and a hit rate. Add one line: "Re-read after
  a cold cache: N tokens, about $X over the session", with the split in the tooltip.
- Prices come from the same table as the notices, so C14 applies. Label the figure "estimated".
- Not a notice: the existing notices warn before the cost. This is a look back, in the panel only.
- Tests: the sum over a recorded sequence of requests; a session with no misses shows nothing.
- Risk: low. Depends on: C14 for the amount, C6 for the detector.

### C18: models that cache by themselves

In the Bedrock data, OpenAI models bill cache writes as a "30m" usage type. Their hit rate is 93% to 97% out
to 10 minutes, 77% to 83% between 20 and 30 minutes, and about 10% from 30 minutes. The AWS guide documents
this: GPT-5.6, GPT-6 and GPT-6.1 list "30 minutes" as the TTL, and "`30m` is the only supported value" for
`prompt_cache_options.ttl`. It is a minimum: cached prefixes "remain available for reuse for at least 30
minutes". Writes on GPT-5.6 and later bill at 1.25 times the uncached input rate; GPT-5.5 and earlier cache
implicitly with no write fee.

- `modelSupportsPromptCacheControl` is true only for Claude on Anthropic and Bedrock, so the toolbar button,
  the countdown and the cold-cache notices are hidden for these models even though their caches expire and a
  pause past 30 minutes costs a full rewrite.
- Proposed: a read-only status for models that cache automatically. The countdown ring runs from a 30-minute
  lifetime and the tooltip says the provider manages it and there is nothing to set. Say "at least 30
  minutes", not "30 minutes".
- GPT-5.6 and later also take explicit `prompt_cache_breakpoint` fields, but "Converse doesn't support
  explicit caching for this model", so Continue's Bedrock path cannot use them. Implicit caching is what
  these models get through Converse, and a cache point in the request is rejected (confirmed live).
- Grok reported reads and never writes; Nova's implicit reuse "isn't reported in the cache usage fields and
  isn't billed as cache reads". So a status for those needs its own wording, and Nova has nothing to show.
- Check first: whether a request through Continue to these models returns cache read and write tokens. The
  live run showed it does for GPT-5.6 and 6.1 Sol.
- Risk: low. Depends on: nothing now.

### C19: long sessions

Sessions open for more than 12 hours were 62% of spend. The share of written tokens above a session's peak
context rose with age: 14% under 15 minutes, 84% for 4 to 24 hours, 93% over a day. That is a cold cache
rebuilt many times, or a context that keeps growing.

- Today the cold-cache notice offers to compact after a pause and the context meter shows size. Neither
  looks at how long the session has lived.
- Proposed, once C13 has Continue's own data: when a session is both old and has had several cold rewrites,
  offer a fresh session with a summary and the expected saving. Not before: the thresholds would be guesses,
  and the data is other tools' sessions.
- A placeholder with an entry condition. Build C13 first.
- Risk: low. Depends on: C13 and a week of data from our own use.

## Live results on Bedrock (2026-11-04)

Run through the built adapter and the built CLI (`dist/cn.js`, headless, a throwaway config and global directory), on the `us.` profiles this role can use. Prompts were about 11,000 to 14,000 tokens and each carried a unique nonce, so every first request was a clean write. Not every model is open to this role, so the sweeps are partial.

| Question                                         | Result                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does the adapter report usage when streaming?    | Yes. One usage chunk per request, after the text.                                                                                                                                                                                                         |
| Does a streamed tool loop cache?                 | Yes. Haiku 4.5, five requests with tool results: 78% of prompt tokens were reads.                                                                                                                                                                         |
| Does the CLI itself cache and record it?         | Yes. Six sequential file reads in one headless session: 49,645 cache read and 16,742 cache write tokens in the session file, 3,141 uncached. A first request of about 3,000 tokens wrote nothing, so a short CLI session starts below the cache minimum.  |
| Claude models, 5-minute cache points             | Haiku 4.5, Haiku 5.5 and Sonnet 5.5 write on request 1 and read on 2 and 3. Only these three were checked for the 5-minute default.                                                                                                                       |
| GPT 5.6 Sol and 6.1 Sol                          | Cache by themselves, with no cache point: write on request 1, read on 2 and 3. They reject a request that carries a cache point; AWS says Converse does not support their explicit breakpoints.                                                           |
| Nova Pro                                         | Rejected the request, which carried a cache point in the tool list; with none sent, no caching shown. AWS lists Nova with checkpoints in `system` and `messages` only; see Nova on Bedrock below.                                                         |
| Grok 4.7                                         | Rejects the cache point; without it, reads appear from request 2 and writes never do.                                                                                                                                                                     |
| Does a read refresh the 5-minute lifetime?       | Yes. An entry written at 0:00 and read at 4:30 was still read at 9:00. Untouched, it was gone at 5:30. An entry read at 4:30 and then left was gone at 9:36 (about 5 minutes after its last read). Same result on Haiku 4.5 and Sonnet 5.5.               |
| Does `ttl: 1h` work?                             | Accepted on Haiku 4.5, Haiku 5.5, Sonnet 5.5 and Opus 5.5. `cacheDetails` reports the lifetime of each write, so the 5-minute and 1-hour split can be priced. Other Claude models were not open to this role, so the allowlist is not confirmed for them. |
| Does a 1-hour entry survive reads at 4:30, 9:00? | Yes. Not tested past an hour.                                                                                                                                                                                                                             |
| GPT 6.1 Sol read after a gap                     | Hit at 5 and at 10 minutes. The runs for 20, 28, 33 and 40 minutes were stopped early, so the 30-minute reading was not tested here. AWS documents it as a minimum of 30 minutes (see Sources).                                                           |

What this changed:

- **A bug, fixed:** `promptCaching: true` sent cache points to every model on Bedrock, which breaks GPT, Nova and Grok. The adapter now sends them to Claude models only (`33ca5f9e4`), and so does `core`'s Bedrock provider (`99cfe2542` on `feat/auto-request-count`). Too broad for Nova, which takes them outside the tool list: see Nova on Bedrock below.
- **Keepalive:** a read refreshes the lifetime, so the 1.3% estimate for pings rests on a confirmed mechanism. It is still a small gain for 71,000 extra requests, so it stays deferred.
- **C18:** GPT models report cache writes with no lifetime detail, and Grok reports reads only. A read-only status needs per-family wording, not one 30-minute ring.
- **Not done:** the fine boundary between 4:30 and 5:06 (the docs do not give it), the long-gap runs for GPT, and the other Claude models.

## Nova on Bedrock (2026-11-08)

Why six `cn serve` runs on Nova 2 Lite (`us.amazon.nova-2-lite-v1:0`, 2026-11-08, plans/loop-mode.md) reported `cachedTokens: 0` and `cacheWriteTokens: 0` on every request, and what changed.

**Does Nova 2 Lite cache on Bedrock?** Yes, both ways. The AWS prompt caching guide's "Supported models" table (read 2026-11-08) lists Nova 2 Lite, Nova Pro, Nova Lite and Nova Micro for explicit caching: minimum "1K" tokens per checkpoint, 4 checkpoints, 5 minutes only, checkpoints in `system` and `messages` (not `tools`), and a footnote that Nova caches at most 20K tokens. Nova also has implicit caching for every text prompt, but the guide says that reuse "isn't reported in the cache usage fields and isn't billed as cache reads". So a Nova run with no cache points may be faster and still show zero, and the zero is real as far as billing goes. Nova Premier and the other Nova 2 models are not in the table. Price (AWS pricing page as relayed by aggregators, 2026-11-08, not read from AWS directly): Nova 2 Lite input $0.30/MTok, cache read $0.075/MTok, no separate write rate.

**Did our requests ask for it?** No, for two reasons, both ours.

1. The Bedrock adapter (the path `cn` uses) and core's Bedrock provider built cache points only when the model ID contained `claude`, after the 2026-11-04 live run above saw Nova Pro refuse a request. That request carried `promptCaching: true`, which puts a cache point in the tool list, the one field Nova does not accept. The refusal was read as "Nova takes no cache points".
2. The CLI's default (`bedrockCachingSettings` in extensions/cli/src/config.ts) turned caching on, when the config said nothing, for Claude only. The scenario config said nothing, so the adapter received `promptCaching: undefined` and sent no cache points.

**Would our usage reading have seen it?** Yes. The adapter maps the Converse stream's `metadata.usage` (`cacheReadInputTokens`, `cacheWriteInputTokens`, `cacheDetails`) into `prompt_tokens_details.cache_read_tokens` and `cache_write_tokens`; the CLI records those as `cachedTokens` and `cacheWriteTokens` in the session usage that `cn serve` exposes in `/state`. The build the scenarios ran carried that mapping (checked in its bundle), and it reported `prompt_tokens` correctly from the same event. Only the request side was missing.

**What changed (branch `claude/bedrock-nova-cache`):**

- `bedrockCachePointFields(modelId)` in both Bedrock helper copies says which fields take a cache point: Claude all three, the four Nova models `system` and `messages`, everything else none. `bedrockCachePartsForModel` masks the configured parts with it, so `promptCaching: true` on Nova caches the system prompt and the last two user messages and leaves the tool list alone; GPT, Grok and unlisted Nova models still get nothing. A core test fails if the two copies disagree.
- `bedrockCacheTtl` already returned the default for a non-Claude model, so no `ttl` reaches Nova.
- The CLI default turns caching on for the four Nova models too, with no lifetime (Nova takes 5 minutes only). `promptCaching: false` still wins.
- `minCacheableTokens` knows Nova's 1,024-token minimum on Bedrock, so the CLI's cache line can say when a request was under it.
- An opt-in live test, `Bedrock.novaCache.live.vitest.ts`, sends two requests with a 1,500-token system prompt and a tool, and expects a write then a read. Run on 2026-11-08 against `us.amazon.nova-2-lite-v1:0` in us-east-1: request 1 wrote 3,123 tokens and read none; request 2 read 3,022 and wrote 101 (the new user message). Cost under a cent.

**For the Loop design (plans/policy-areas.md):** the stable-prefix argument holds on Nova 2 Lite once cache points are sent, with two limits that Claude does not have: only the first 20K tokens of the prompt are cached, and the lifetime is 5 minutes with no 1-hour option, so a loop that pauses longer than that between model calls rewrites its prefix. The Bedrock models with the fullest support stay the Claude rows of the AWS table (tools, system and messages; 512 to 4,096-token minimums; 5 minutes or 1 hour). GPT on Bedrock caches implicitly with no cache points through Converse; Grok reports reads only.

**Verified live** (2026-11-08): Nova 2 Lite accepted a request with a tool list, a cache point after the system prompt and one on each of the last two user messages, and reported the write and the read in `metadata.usage`. The field table otherwise comes from the AWS guide and the 2026-11-04 refusal.

## Sources, read 2026-11-04

What the vendors' own documentation says about each finding. Quotes are from the pages named. The AWS
Bedrock price table is rendered by script and came back as unresolved placeholders, so no per-model dollar
figure was read from it.

| Finding                              | Source                                             | What it says                                                                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A hit refreshes the lifetime         | AWS prompt caching guide; Anthropic prompt caching | "The cache has a Time To Live (TTL), which resets with each successful cache hit." Anthropic: a hit is "also a cache refresh". Matches the live run that read at 4:30 and 9:00.                                                                    |
| `ttl` values                         | AWS API reference, `CachePointBlock`               | `type: default`, optional `ttl` of `5m` or `1h`.                                                                                                                                                                                                   |
| `cacheDetails`                       | AWS API reference, `TokenUsage`                    | "Detailed breakdown of cache writes by TTL. Empty if no cache creation occurred. Sorted by TTL duration (1h before 5m)."                                                                                                                           |
| `inputTokens` excludes cached tokens | AWS guide, Converse section                        | "total input tokens = inputTokens + cacheReadInputTokens + cacheWriteInputTokens".                                                                                                                                                                 |
| No header is needed                  | AWS guide                                          | It never mentions `x-amzn-bedrock-enablepromptcaching`; the live run cached without it.                                                                                                                                                            |
| 1-hour list                          | AWS guide, supported models table                  | Every Claude row lists "5 minutes, 1 hour". Sonnet 4.5 is not in the table. A `ttl` on a model that takes only 5 minutes "can result in a `ValidationException`".                                                                                  |
| Minimum prompt length                | AWS guide; Anthropic                               | A checkpoint below the minimum "still succeeds, but your prefix isn't cached". 512 tokens for the 5.x models, 1,024 for Sonnet 4.6, Sonnet 5 and Opus 4.8, 4,096 for Haiku 4.5 and Opus 4.5 to 4.7 on Bedrock (Anthropic lists Opus 4.7 at 2,048). |
| Four checkpoints                     | AWS guide                                          | "up to 4 for Claude models", and the lookback checks "only about 20 content blocks".                                                                                                                                                               |
| 1-hour before 5-minute               | Both                                               | "A 1-hour cache entry must appear before any 5-minute cache entries."                                                                                                                                                                              |
| Regional premium                     | Anthropic pricing                                  | "Regional and multi-region endpoints include a 10 percent premium over global endpoints", for Sonnet 4.5, Haiku 4.5, Opus 4.5 and later; earlier models keep their pricing.                                                                        |
| OpenAI lifetime and fee              | AWS guide, OpenAI section                          | GPT-5.6 and later: "`30m` is the only supported value", reused "for at least 30 minutes", writes at 1.25 times input. GPT-5.5 and earlier: implicit, no write fee.                                                                                 |
| Explicit caching on GPT              | AWS guide                                          | "Converse doesn't support explicit caching for this model."                                                                                                                                                                                        |
| Nova                                 | AWS guide                                          | Implicit reuse "isn't reported in the cache usage fields and isn't billed as cache reads". Explicit checkpoints on some Nova models, 5 minutes.                                                                                                    |
| Automatic caching (Claude)           | AWS guide                                          | One top-level `cache_control` via `additionalModelRequestFields`, on Haiku 4.5, Sonnet 4.6, Opus 4.7 and later. It uses one of the four checkpoint slots. Other models return a `ValidationException`.                                             |

Not in the documentation: the boundary between 4:30 and 5:06 (the docs say "5 minutes" and the live run
agrees), the exact point a 30-minute GPT entry expires, and any per-model Bedrock dollar figure.

What changed in the code because of these (branch `fix/cache-minimum-and-ttl-allowlist`, `fe1806238`):

- **The minimum prompt length is now known per model.** A first request under it is accepted and not cached,
  with no error. This is what the live CLI run hit: about 3,000 tokens on Haiku 4.5, which needs 4,096. The
  status no longer shows a warm cache for it, the tooltip says why, and the cold-resume notice stays quiet.
- **The Bedrock 1-hour list follows the AWS table.** Sonnet 4.5 is out, since it is not in the table.
- **The regional premium covers `us.`, `eu.`, `apac.`, `jp.`, `au.` and `ca.`** on the models Anthropic names.

The tips icon (C21, `feat/cache-tips`) is where this advice reaches the user: `cacheTips(model, setting)` returns a list, the toolbar shows a triangle only when the list is not empty, and a dismissal is stored per model and tip. Candidates for more tips, each needing its own source and test: a first prompt under the model's cache minimum (the status already says it; the tip could say how to reach it), caching off on a long conversation (today a notice), and a model with a cheaper listed equivalent. Not built: a tip that needs data the app does not have, such as the region the AWS account can reach.

The session ledger (C22, `feat/cache-ledger`) is the source for tips drawn from the conversation itself. `cacheLedger.ts` keeps one record per request (time, mode, model, whether caching was on, the lifetime asked for, uncached, read, 5-minute and 1-hour write and output tokens, pruned, miss causes), capped at 200, in memory, not saved, empty in each new conversation. `replayInputCost` prices the recorded sizes and pauses under each policy: a request reads the previous prompt while that entry is alive (a read refreshes it, as AWS and Anthropic document) and writes the rest; a model change, a pruned prompt or a prompt under the model's cache minimum breaks the chain. The first tip built on it says when another lifetime would have cost at least 10% and 25 cents less on the input side, after 6 requests, and only when a replay of what really happened agrees with the cost computed from the recorded tokens within 15%. That agreement check is the guard: if the model of the cache in the replay is wrong for a session, the tip stays quiet instead of quoting a figure. Not built: the gap-by-cause split (needs the time spent waiting for tool approval, which the app was not checked for), orphan writes, and the miss-cause tally; each is a function of the ledger plus, for the first, one more recorded field.

Not done: Anthropic's automatic caching (a possible simplification, not a drop-in, since it takes a slot and
is unsupported on some models), and a minimum-length check in the CLI adapters.

## Order

| Order | Feature         | Why here                                                         |
| ----- | --------------- | ---------------------------------------------------------------- |
| 1     | C14             | Small, independent, makes every dollar figure honest             |
| 2     | C16 check       | A few cents of live testing; may be the largest finding          |
| 3     | C11a, C11b, C13 | In the adaptive plan; C13 produces the data C15 and C19 wait for |
| 4     | C17             | Reuses the detector, needs C14                                   |
| 5     | C16 build       | Sized after the check                                            |
| 6     | C15             | After a week of C13 data from Continue's own Agent use           |
| 7     | C18, C19        | Each waits on a check or on data                                 |

## Not building

- Per-person tuning from history: no gain on 3.5 weeks of data (+0.2%).
- Keepalive pings: -1.3% at best for 71,000 extra requests, and a read refreshing the lifetime is unmeasured.
- A context-size trigger for the 1-hour lifetime: weaker than the request count (-1.8% against -3.8%).
- Tuning the 5 to 55 minute window: moving the upper bound changes the total by under 0.2%.
- Anything that depends on knowing who the user is. The data is other people's tools.

## Open questions

| Question                                                                    | How to settle it                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Does the CLI on Bedrock cache at all?                                       | Run it once and read the cache tokens (the C16 check)               |
| Do the thresholds hold for Continue's own users?                            | C13, a week of our own Agent use, then Chat                         |
| What is the right factor for `eu.`, `apac.` and `global.` Bedrock profiles? | An AWS price list, or a billing line per profile                    |
| Does the cache count from the start of a request or its end?                | A live test with a response long enough to tell; the logs could not |
| Is caching on by default acceptable to whoever owns the billing?            | The owner's call (C15); this plan only says what the data supports  |
