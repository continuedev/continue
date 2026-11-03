# Plan: prompt caching controls (Track C)

Status: C0 to C3 are built and in review (see section 9); defaults are unchanged (caching stays off unless chosen). Written 2026-11-02 against `origin/main` 37a972cfd and updated 2026-11-03 with live Bedrock measurements. See [`ROADMAP.md`](./ROADMAP.md) for where this sits. The cost model in section 5 is [`prompt-caching-sim.mjs`](./prompt-caching-sim.mjs); run it with `node plans/prompt-caching-sim.mjs`.

## 1. Problem

A cached prompt prefix expires after a period of inactivity, 5 minutes by default on Anthropic. In an Agent session that gap is easy to hit: a tool call waiting for a click, a long build or test run, or the user reading and thinking. The next request then re-reads the whole conversation at the cache-write price (1.25x the base input price) instead of the cache-read price (0.1x).

Today the extension cannot do much about it:

- Caching is off unless you set `promptCaching: true` by hand, and the lifetime is always 5 minutes. No code path sends a `ttl`.
- The toolbar has a switch for reasoning and nothing for caching.
- Where caching is on, some of it does not work (section 4).

Goals:

- Caching on by default where it pays, with a default that is cheap in the common case and cannot break a provider.
- Choose the lifetime (5 minutes, 1 hour, Auto) or turn caching off, from the toolbar and from `config.yaml`.
- Show whether the cache is warm, and what a model, reasoning or mode change will cost while it is.
- Fix the placement problems that stop Agent loops from hitting the cache at all.

Non-goals: a response cache of our own; caching for autocomplete or embeddings; provider-specific retention knobs for OpenAI and Gemini beyond what section 6.6 lists.

## 2. Summary

1. Direct Anthropic, Vertex and Bedrock all default to caching off, and the same flags mean different things in each (4.1).
2. On the direct Anthropic path, the cache marker goes on text blocks of the last two user messages. In an Agent loop those messages hold only tool results, so no marker is placed anywhere (4.2, run).
3. On the Bedrock path, a message's bytes change when it leaves the "last two user messages" window, because a session-ID suffix is appended while it is inside it. In a chat that can stop the conversation from hitting the cache; in an Agent loop the effect is smaller (4.3, bytes compared; hit rate not measured).
4. The system prompt is rebuilt per request from rules matched against the latest tool output, so it can change mid-session and invalidate everything after it (4.4, read from code).
5. We cannot see any of this: Bedrock usage is logged to the console and dropped, the Anthropic path drops the 5-minute versus 1-hour write split, and the price table has no 1-hour price (4.5).
6. Recommended default: caching on for Claude models, lifetime Auto (5 minutes until a gap between 5 and 55 minutes is observed, then 1 hour for the rest of the session), always overridable (section 6). Section 5 shows why, and where it loses.

## 3. Research

Read on 2026-11-02 from the pages listed in section 11. Prices are from Anthropic's table as fetched that day and will change.

### 3.1 Anthropic Messages API

- The cache is a prefix match over `tools`, then `system`, then `messages`. A change anywhere in the prefix invalidates everything after it.
- Default lifetime 5 minutes, refreshed at no charge on every hit. Optional `ttl: "1h"` on `cache_control`. The lifetime counts from the start of the request that wrote or read the entry, not from the end of its response, so a 4-minute stream leaves about a minute.
- Multipliers on the base input price: 5-minute write 1.25x, 1-hour write 2x, read 0.1x. A few newer models have a cheaper read (0.05x or 0.025x). Breakpoints themselves cost nothing.

  | Model          | Base | 5m write | 1h write | Read  |
  | -------------- | ---- | -------- | -------- | ----- |
  | Sonnet 4.6     | $3   | $3.75    | $6       | $0.30 |
  | Opus 4.5 - 4.8 | $5   | $6.25    | $10      | $0.50 |
  | Haiku 4.5      | $1   | $1.25    | $2       | $0.10 |

- Mixed lifetimes in one request are allowed, but a 1-hour entry must come before any 5-minute entry.
- Minimum cacheable prefix: 512 tokens on the newest models, 1,024 for Sonnet 4.x and Opus 4.8, 2,048 for Opus 4.7, 4,096 for Opus 4.5 and 4.6 and Haiku 4.5. A shorter prompt is processed uncached with no error and no charge.
- Lookback is 20 blocks per breakpoint. A run of consecutive `tool_use` blocks counts as one position and so does a run of `tool_result` blocks.
- Automatic caching: one top-level `cache_control` that the API moves to the last cacheable block. It takes one of the 4 breakpoint slots and is available everywhere except the legacy Bedrock integration for Opus 4.6 and earlier.
- Changing thinking parameters or the effort setting invalidates the message cache. Switching models starts an empty cache. Adding or removing images changes message blocks.
- `usage.cache_creation` splits writes into `ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens`.
- `max_tokens: 0` writes the cache and returns no output. It is rejected when extended thinking, streaming or structured outputs are set.
- Cache diagnostics (pass the previous response `id`) reports where two consecutive requests diverged, for supported models.
- The current page shows no beta header for the 1-hour lifetime. Our code sends `anthropic-beta: prompt-caching-2024-07-31` whenever caching is on; whether that header is still needed was not checked.

### 3.2 Claude Code (closest prior art)

- It picks a lifetime per request from two buckets: the main conversation, and everything else (subagents, compaction, titles).
- Defaults: 1 hour for the main conversation only on a Claude subscription within plan usage. On an API key, a cloud provider or usage credits, 5 minutes. So its default for pay-per-token billing is 5 minutes.
- Overrides: `promptCacheTtl` and `subagentPromptCacheTtl` settings, matching environment variables, `FORCE_PROMPT_CACHING_5M`, `ENABLE_PROMPT_CACHING_1H`. Values other than `5m` and `1h` are ignored.
- It asks for confirmation on a model switch only while the cache is warm, and shows a "Prompt cache" line with hit ratio, misses, whether the cache is warm, and a likely cause for the last miss.
- Its docs list what keeps the cache (editing files, changing permission mode, rewinding) and what breaks it (model switch, effort change, adding or removing an MCP server, compaction, upgrading).
- The engineering post (Apr 30, 2026): static content first and dynamic content last; put updates in the next message instead of the system prompt; never change models or tools mid-session; alert on the hit rate; run compaction with the parent's exact prefix.

### 3.3 Amazon Bedrock

- Explicit checkpoints (`cachePoint`), up to 4 per request. `CachePointBlock.ttl` (`5m` or `1h`) and `TokenUsage.cacheDetails` (writes per lifetime) exist in `@aws-sdk/client-bedrock-runtime` 3.1161.0, the version installed here.
- 1 hour is listed for Claude Haiku 4.5, Sonnet 4.5 and later, Opus 4.5 and later. Claude 3.7 Sonnet and 3.5 Sonnet v2 are listed as 5 minutes only. Sending `ttl` to a 5-minute-only model can fail with a `ValidationException`.
- `inputTokens` excludes cached tokens when caching is on: total input = `inputTokens + cacheReadInputTokens + cacheWriteInputTokens`.
- A "simplified" mode takes one checkpoint at the end of static content and looks back about 20 blocks for a hit.
- OpenAI models on Bedrock list a 30-minute lifetime. Nova models list 5 minutes and a 20K-token cache limit.

### 3.4 OpenAI, OpenRouter, Gemini

- OpenAI GPT-5.6 and later: `prompt_cache_options.ttl` of `30m` (default, write 1.25x) or `12h` (write 2.5x). Earlier models: `prompt_cache_retention` of `in_memory` (5 to 10 minutes idle, up to an hour) or `24h`, defaulting to `24h` unless Zero Data Retention is on. Minimum prefix 1,024 tokens.
- OpenRouter passes Anthropic `cache_control` and `ttl: "1h"` through. It pins a conversation to one provider for 10 minutes of inactivity, and accepts a `session_id` (body field or `x-session-id` header) as the pinning key.
- Gemini through OpenRouter: 5-minute lifetime that hits do not refresh. Google's own caching page was returned as HTML and not read.

### 3.5 Papers (abstracts only; full texts not read)

- "Don't Break the Cache" (arXiv 2601.06007): across OpenAI, Anthropic and Google on 500+ agent sessions with 10,000-token system prompts, caching cut API cost 41 to 80% and time to first token 13 to 31%. Controlling which blocks are cached (dynamic content at the end of the system prompt, excluding dynamic tool results) was more consistent than caching the full context, which could increase latency.
- TokenPilot (2606.17016) and CADOC (2609.37012): context-pruning schemes that schedule edits in batches to avoid breaking the cache; they report roughly 40 to 87% lower cost. Relevant to compaction, not to this plan.
- WAKMan (2610.36355): server-side eviction. It notes agentic steps return within seconds, which matches the "flow state" case in section 5.

## 4. Current state (read from the code)

"Run" means I ran a throwaway test and deleted it afterwards; nothing from it is in the repository. "Read" means I read the code and did not run it.

### 4.1 Defaults and flags differ by provider (read)

| Provider path                                                         | Caching on when                                                                                          | System prompt marked when                | Tools marked when    | Lifetime sent     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------- | ----------------- |
| `core/llm/llms/Anthropic.ts`                                          | `cacheBehavior.cacheConversation` **or** `completionOptions.promptCaching`                               | `cacheBehavior.cacheSystemMessage` only  | never                | none (always 5 m) |
| `core/llm/llms/VertexAI.ts`                                           | `cacheBehavior.cacheConversation` `??` `promptCaching` (an explicit `false` wins here, not in Anthropic) | `cacheBehavior.cacheSystemMessage` only  | never                | none              |
| `core/llm/llms/Bedrock.ts`                                            | `cacheConversation`, or `cacheSystemMessage`, or `promptCaching`                                         | `cacheSystemMessage`, or `promptCaching` | `promptCaching` only | none              |
| `packages/openai-adapters` Anthropic (the CLI builds its client here) | on unless `cachingStrategy` is `none`; default `systemAndTools`                                          | by strategy                              | by strategy          | none              |

The first three are off by default; the adapter is on by default. A user who sets `promptCaching: true` (what `docs/customize/model-providers/top-level/anthropic.mdx` shows) gets a different set of markers on each path. The `cacheBehavior` field is declared in `core/index.d.ts`, `core/config/types.ts`, the config-yaml zod schema and three places in `extensions/vscode/config_schema.json`.

### 4.2 Agent loops lose the conversation cache on the direct Anthropic path (run)

`addCacheControlToLastTwoUserMessages` walks back over user-role messages, counts each one, skips string content, and marks only a block of `type: "text"`. A tool result is a user-role message holding a `tool_result` block. I built a session with one user message and three tool calls and ran it through `convertMessages(..., true)`:

```
user[text]  assistant[tool_use]  user[tool_result]  assistant[tool_use]
user[tool_result]  assistant[tool_use]  user[tool_result]      -> no block has cache_control
```

The last two tool-result messages use up the count of two, so the walk stops before it reaches the user's text. A plain chat (`q1 a1 q2`) marks both user messages. By the same walk, a session with one tool result still reaches the user's text and gets one marker, so the loss starts at the second tool result; I did not run that case. Nothing is cached past a breakpoint, so with no breakpoint a long Agent session pays full input price on the direct Anthropic path. I did not measure the hit rate against the live API. The Bedrock path adds a `cachePoint` block rather than editing a text block, so it does not have this problem (4.3 has another).

### 4.3 Bedrock rewrote old messages as they left the window (run; confirmed live)

`_addCachingToLastTwoUserMessages` appended `<!-- SID: <uuid> -->` to the text of the last two user messages and added a `cachePoint`. When a message left that window the suffix was gone. Comparing the converted messages of consecutive requests in a chat:

```
request N     q1   a1  q2+SID  a2  q3+SID
request N+1   q1   a1  q2      a2  q3+SID  a3  q4+SID
per-message byte-identical:  [true, true, false, true, true]
```

**Confirmed against Bedrock on 2026-11-02** (Haiku 4.5, 5 turns, about 7,000 tokens first turn and 1,450 added per turn). Old code: cache reads stopped growing after turn 2 and every later turn re-wrote 4,400 to 5,800 tokens at the write price.

| Turn | Old: read / written | Fixed: read / written |
| ---- | ------------------- | --------------------- |
| 1    | 0 / 6,793           | 0 / 6,789             |
| 2    | 6,793 / 1,482       | 6,789 / 1,450         |
| 3    | 5,332 / 4,392       | 8,239 / 1,449         |
| 4    | 5,332 / 5,846       | 9,688 / 1,454         |
| 5    | not run             | 11,142 / 1,427        |

The suffix is not an accident. PR #5035 added it because Bedrock caches at the AWS account level, so identical prompts from different users or processes would share entries. The fix keeps the conversation isolated and removes the instability: the ID goes on the first user message only, so every cached prefix after it includes it and no message changes once sent.

**Isolation, checked live.** Two separate processes sent the same system prompt and then the same first user message. Process A wrote 6,790 tokens. Process B's first request read 5,330 tokens of that and wrote only 1,459. The 5,330 is the system prompt, which comes before the ID and is therefore shared across processes; the user turn, which carries the ID, was not shared (B wrote it fresh). This is the same exposure the old code had, since the old code also put the ID only on user messages. It means a system prompt is shareable between users of one AWS account. If a system prompt is confidential, that is a decision for the owner of #5035, and fixing it would need the ID inside the system prompt text itself, which changes what the model sees.

### 4.4 The prefix can change from the first token (read)

Cache order is tools, system, messages, so a change in the system prompt invalidates the whole conversation.

- `constructMessages` builds the system message on every request through `getSystemMessageWithRules`, from the latest user or tool message and the context items since the last user message. A rule with a file glob or regex is added when a matching path appears in the newest tool result and dropped again at the next user message.
- A conversation summary is appended to the system message.
- `compileChatMessages` (`core/llm/countTokens.ts`) removes the oldest messages whenever the history exceeds the available tokens. A session near the limit can drop messages from the front on every turn, which changes the prefix every turn.
- Switching mode changes the system message and the tool list. Toggling reasoning changes the thinking parameters. Both invalidate by the API's rules (3.1).

I did not find a date or time in `defaultSystemMessages.ts`, which is the one file I checked for that.

### 4.5 We cannot see any of it (read)

- Bedrock: the stream handler prints `chunk.metadata.usage` with `console.log` and returns no `Usage`. There is no token, cache or cost record for Bedrock.
- Anthropic: `Usage.promptTokensDetails` has `cachedTokens` and `cacheWriteTokens`, filled from `cache_read_input_tokens` and `cache_creation_input_tokens`. The 5-minute versus 1-hour split in `cache_creation` is dropped.
- `calculateRequestCost.ts` has one `cacheWrite` price per model (the 5-minute one) and no 1-hour price. Its table has no entry for Haiku 4.5, Sonnet 4.5 or Opus 4.7 and 4.8, so those models get no cost. It only prices the `anthropic` and `openai` providers; Bedrock, Vertex and OpenRouter return `null` whatever the model.
- The usage panel's "Cache Hit Rate" divides cache-read tokens by `interaction.end.promptTokens`, which `_logEnd` computes with a local `countTokens(prompt)`. It is a ratio against an estimate, not against the API's own input count.

### 4.6 Foreground commands are capped at two minutes on the local path (read)

On the local branch of `runTerminalCommand.ts`, `DEFAULT_TOOL_TIMEOUT_MS = 120_000` kills a foreground command after two minutes (SIGKILL 5 s later if it is still running). A foreground command therefore cannot outlast a 5-minute cache by itself there. I did not read the remote branch, which hands the command to `ide.runCommand()`. The long gaps come from approval prompts, background commands whose results are read later (`waitForCompletion: false`), and the user's own time. If tool timeouts become configurable, the cache lifetime setting should be mentioned next to them.

## 5. Cost model

[`prompt-caching-sim.mjs`](./prompt-caching-sim.mjs) replays request timelines against four lifetime policies at Anthropic's list multipliers (write 1.25x for 5 minutes, 2x for 1 hour, read 0.1x). Dollars use $3 per million tokens. It ignores output tokens, the minimum prefix, the 20-block lookback and the fact that a lifetime is counted from the start of a request. It is a model of the pricing rules, not a measurement of any session.

| Scenario (context grows 2,000 tokens per request unless noted)  | No cache | 5m           | 1h           | Escalate     | 5m + keepalive |
| --------------------------------------------------------------- | -------- | ------------ | ------------ | ------------ | -------------- |
| 60 requests, 25 s apart                                         | $14.58   | $1.94 (13%)  | $2.26 (15%)  | $1.94 (13%)  | $1.94 (13%)    |
| Same, plus an 11 min and an 8 min command                       | $14.58   | $2.60 (18%)  | $2.26 (15%)  | $2.53 (17%)  | $2.02 (14%)    |
| 40 requests, every 5th follows a 10 min command                 | $7.32    | $2.82 (38%)  | $1.30 (18%)  | $1.40 (19%)  | $1.38 (19%)    |
| 60 requests, one 45 min break near the end                      | $14.58   | $2.35 (16%)  | $2.26 (15%)  | $2.67 (18%)  | $2.35 (16%)    |
| 60 requests, resumed the next morning (10 h)                    | $14.58   | $2.35 (16%)  | $2.94 (20%)  | $2.35 (16%)  | $2.35 (16%)    |
| Chat, 1 to 40 min of think time, 20 turns (1,500 tokens a turn) | $1.43    | $0.73 (52%)  | $0.36 (25%)  | $0.40 (28%)  | $0.73 (52%)    |
| Chat, each reply read for 20 min, 20 turns                      | $1.43    | $1.78 (125%) | $0.36 (25%)  | $0.39 (28%)  | $1.78 (125%)   |
| One prompt, never followed up                                   | $0.03    | $0.04 (125%) | $0.06 (200%) | $0.04 (125%) | $0.04 (125%)   |

Reading it:

- When requests are seconds apart (the common Agent case) every cached policy costs 13 to 15% of the no-cache bill. The lifetime hardly matters; having a breakpoint at all does (4.2).
- When gaps run between 5 and 55 minutes, 5 minutes loses badly: in the "every 5th request follows a 10 min command" row it costs twice the 1-hour price, and in the last chat rows it costs more than no caching. 1 hour wins there.
- 1 hour loses when the session is short or the break is long: 200% of no-cache for a single prompt, 20% against 16% after a 10-hour break.
- "Escalate" starts at 5 minutes and switches to 1 hour for the rest of the session after it sees a gap between 5 and 55 minutes. Across these eight rows its worst bill is 125% of no-cache (the cost of any caching on a one-shot prompt) and its worst loss to the best policy is $0.51 (3 points of the no-cache bill, in a row where keepalive wins). Fixed 5 minutes loses up to $1.51, fixed 1 hour up to $0.58. That is a small set of invented scenarios, not a proof; the rule should be checked against real session logs once C0 records them.
- "5m + keepalive" sends a cheap read every 4 minutes while a known command is running (`ping` cost 0.1x the context). It beats escalation only when the wait is a tool wait of at most about 25 minutes (6 pings), and does nothing for think time. It needs a background timer and an extra request per ping, so it stays out of the first release.
- A rule that cannot learn in advance: the lifetime is fixed when the entry is written, before the gap exists. The only signal is past behaviour in this session, which is what "escalate" uses.

## 6. Design

### 6.1 One policy, resolved in one place

Today four code paths each read `cacheBehavior` and `promptCaching` their own way (4.1). Replace that with one pure function in `core/llm/cachePolicy.ts`:

```ts
type CacheTtl = "5m" | "1h";
interface CachePolicy {
  enabled: boolean;
  ttl: CacheTtl; // what to send on this request
  tools: boolean;
  system: boolean;
  conversation: boolean;
}
resolveCachePolicy(model, config, sessionCacheState, now): CachePolicy;
```

Precedence, highest first:

1. The toolbar choice for this model (Off, 5 min, 1 hour, Auto), stored like `reasoningSettings`.
2. `cacheBehavior.ttl` and `defaultCompletionOptions.promptCaching` in `config.yaml`. An explicit `promptCaching: false` always turns caching off, on every path (Vertex already behaves this way, Anthropic does not).
3. The default: on for Claude models on Anthropic, Bedrock, Vertex and OpenRouter (`anthropic/*`), lifetime Auto. Everything else is unchanged.

The existing `cacheSystemMessage` and `cacheConversation` stay as per-part switches. When `enabled` is true and neither is set, all three parts (tools, system, conversation) are cached.

New `config.yaml` surface, all optional:

```yaml
models:
  - name: Claude Sonnet
    provider: anthropic
    model: claude-sonnet-4-6
    cacheBehavior:
      ttl: auto # auto | 5m | 1h
    defaultCompletionOptions:
      promptCaching: true # false turns caching off
```

`ttl` is added to `cacheBehaviorSchema` in config-yaml, `core/index.d.ts`, `core/config/types.ts` and `extensions/vscode/config_schema.json`. Values other than the three are ignored, as Claude Code does.

### 6.2 Breakpoints

Up to four, all with the same lifetime (a 1-hour entry must precede 5-minute ones, so one lifetime per request avoids that rule):

1. The last tool definition.
2. The system prompt.
3. The last non-thinking block of the final user-role message, whatever its type (`text`, `tool_result`, image, document).
4. The last non-thinking block of the previous user-role message.

Markers 1 and 2 cost nothing and give a partial hit when only later content changes: a rule added to the system prompt (4.4) or a pruned history still reads the tools, and a pruned history still reads the system prompt. Markers 3 and 4 follow the "second to last to read, last to write" reasoning already in the code, and the lookback treats a run of consecutive `tool_result` blocks as one position (3.1).

The fix for 4.2 is in `addCacheControlToLastTwoUserMessages` in `packages/openai-adapters`: mark the last non-thinking block of each of the last two user-role messages, and convert string content to a one-block array instead of skipping it. Core's Anthropic provider, core's Vertex provider (through the Anthropic converter) and the adapter's Anthropic and OpenRouter paths import that helper, so one change covers them; their tests change with it. Core's own `OpenRouter.ts` has a separate copy of the "last two user messages" logic (`lastTwoUserMsgIndices`) that I did not read in full and that needs the same fix.

An alternative is one top-level `cache_control` that the API moves forward (3.1). It needs a newer SDK type than the pinned 0.62.0 and does not exist on the legacy Bedrock integration, so it is a later simplification, not the plan.

### 6.3 Lifetime: Auto

Per session, held in the GUI's session state and not persisted:

```
lastRequestStartedAt: number | undefined
escalated: boolean            // false at the start of every session

before each request:
  gap = now - lastRequestStartedAt          // start to start
  if lastRequestStartedAt && 300s < gap <= 3300s: escalated = true
  ttl = escalated ? "1h" : "5m"
  lastRequestStartedAt = now
```

The 300 s lower bound is the point where a 5-minute entry has expired, so a gap above it is a gap 1 hour would have covered. The 3,300 s upper bound is my guess: a gap near an hour says little about whether the next one will be, and a lifetime is counted from the start of the previous request, so an hour leaves no margin. Both numbers should be tuned on real logs after C0. Once escalated, the session stays on 1 hour. A session that never has such a gap stays on 5 minutes, so a one-shot prompt pays the 5-minute write (125% of no-cache in the model) and not the 1-hour one (200%). Resuming a saved session starts un-escalated, and the first request after a long break pays the full write either way.

### 6.4 Per provider

| Path                         | Lifetime sent                                              | Notes                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic (core and adapter) | `cache_control: {type: "ephemeral", ttl}`; no `ttl` for 5m | Check once against the live API whether the `anthropic-beta` header is still needed (3.1), and whether a gateway at `apiBase` forwards it.                                                                              |
| Vertex (Anthropic models)    | same                                                       | Uses core's Anthropic converter; the beta header is set separately in `VertexAI.ts`. Vertex's own support for a 1-hour lifetime was not read.                                                                           |
| Bedrock Claude               | `cachePoint: {type: "default", ttl}`                       | Send `ttl` only for model IDs on an allowlist built from the Bedrock table (3.3); unknown IDs get 5 minutes. On a `ValidationException` that names `ttl`, retry once without it and remember the model for the session. |
| OpenRouter `anthropic/*`     | `cache_control` with `ttl`                                 | Pass `session_id` so provider pinning does not depend on the first message (3.4).                                                                                                                                       |
| OpenAI, Gemini, others       | none                                                       | Automatic or provider-managed. `prompt_cache_options.ttl` and `prompt_cache_retention` are a later item (C6). The toolbar control is hidden for these models.                                                           |

### 6.5 Visibility

- Core: `Usage.promptTokensDetails` gains optional `cacheWriteTokens5m` and `cacheWriteTokens1h`, filled from Anthropic's `usage.cache_creation` and Bedrock's `cacheDetails`. Bedrock starts returning a `Usage` at all, with total input computed as `inputTokens + cacheReadInputTokens + cacheWriteInputTokens` (3.3).
- `calculateRequestCost.ts` gets the 1-hour price (2x base), the missing Claude models, and entries for `bedrock`, `vertexai` and `openrouter` that map model IDs onto the Anthropic table. The table carries a "last checked" date and a test that fails when a Claude model ID known to `llm-info` has no price.
- Hit rate: cache-read tokens divided by input plus read plus write as the API reports them, not by the local token estimate.
- Miss cause: before each request, hash the tools, the system prompt and each message; compare with the previous request in the session; report the first position that differs ("system prompt changed", "tool list changed", "message 14 changed") next to the hit rate in the usage panel and the dev log. This is the client-side equivalent of Claude Code's "likely cause" line. Anthropic's server-side cache diagnostics (3.1) are a later cross-check.

### 6.6 Not in the first release

- Keepalive pings while a background command runs (section 5: helps only tool waits up to about 25 minutes, and needs a timer and an extra request per ping).
- A pre-warm with `max_tokens: 0` when the user opens a saved session (rejected when thinking is on, and the user may never send anything).
- Keeping the system prompt and tool list identical across Chat, Plan and Agent, and moving rule text out of the system prompt into the newest message. Claude Code does both (3.2); both change what the model sees, so they need their own evaluation. C0's miss-cause report will show how often they matter.
- Cache-safe compaction and summaries: reuse the parent's exact prefix and append the instruction.

## 7. UI

The reasoning button in `InputToolbar.tsx` is an icon that toggles a per-model setting kept in `uiSlice.reasoningSettings` and persisted by redux-persist. Caching needs four states, not two, so it gets a small menu rather than a toggle:

- An icon next to the reasoning button, shown only when the selected model supports caching (section 6.4). Filled when caching is on, outlined when off.
- Clicking it opens a menu: **Auto** (default), **5 minutes**, **1 hour**, **Off**. Each row has one line of cost text drawn from the model's price: for example "1 hour: writes cost 2x instead of 1.25x; worth it if you often pause 5 to 55 minutes".
- The tooltip shows the state: "Cache: warm, 1 hour, 41 minutes left" or "Cache: expired" or "Cache: off". "Warm" means a request started within the current lifetime; it is the client's estimate, not something the API reports.
- A per-model setting, stored in `uiSlice.cacheSettings` next to `reasoningSettings` and added to the persist whitelist in `store.ts`.
- When the cache is warm and the user changes model, reasoning, or mode, a one-line notice says what it costs, using the last request's prompt size: "Switching model re-reads about 84,000 tokens at full price (about $0.25 on Sonnet)". Changing mode is included because it changes the system prompt and tools (4.4). The notice informs and does not block.
- The usage panel shows hit rate, tokens written at each lifetime, estimated saving against no caching, and the last miss cause (6.5).

Whether the menu is a new component or reuses an existing popover is decided in C3 after reading the model-picker code; I did not read it.

## 8. Settings and defaults

| Setting                   | Default                                      | Reason                                                                                                                                                                |
| ------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Caching for Claude models | on                                           | With Auto, a cached session costs 13 to 28% of an uncached one in seven of the eight modelled cases (section 5). The exception is a single prompt (125%).             |
| Lifetime                  | Auto                                         | Worst loss to the best fixed policy was $0.51 in the model, against $1.51 for 5 minutes and $0.58 for 1 hour. Claude Code defaults to 5 minutes for API-key billing.  |
| Auto's window             | escalate after a 5 to 55 minute gap          | Section 6.3. The upper bound is a guess.                                                                                                                              |
| Breakpoints               | tools, system, last two user-role messages   | Section 6.2.                                                                                                                                                          |
| Bedrock `ttl`             | only for allowlisted model IDs               | An unsupported `ttl` can fail the request (3.3).                                                                                                                      |
| Non-Claude models         | unchanged                                    | No evidence gathered for them beyond section 3.4.                                                                                                                     |
| Existing configs          | an explicit `promptCaching: false` stays off | Nothing silently turns on for a user who turned it off. A config with no setting gets the new default, which raises write cost 25% on the first request of a session. |

Turning the default on changes billing for existing users. The release note says so and says where the switch is.

## 9. PR breakdown

| PR  | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Depends on |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| C0  | Measure first: Bedrock returns `Usage` (input, read, write, per-lifetime writes); Anthropic keeps the 5m/1h split; the 1-hour price and missing Claude models in the cost table; hit rate against API input counts; the miss-cause report. No behaviour change to requests. **Built** (the miss-cause report is not).                                                                                                                                                                                                                                                                                                                                                                            | none       |
| C1  | Fix the placement bugs: the shared helper marks the last block of each of the last two user-role messages (4.2), core `OpenRouter.ts` gets the same fix, and Bedrock stops editing old messages' text (4.3, after C0 shows whether it matters). **Built.** The Bedrock part is confirmed live; the Anthropic part is mock-tested only.                                                                                                                                                                                                                                                                                                                                                           | C0         |
| C2  | `resolveCachePolicy`, the `cacheBehavior.ttl` field in every schema, one meaning for `promptCaching: false`, tools and system breakpoints on all Claude paths, `ttl` sent on Anthropic, Vertex and OpenRouter, Bedrock allowlist and retry. Default stays off. **Partly built:** per-request `promptCaching` and `promptCacheTtl` on Anthropic and Bedrock, and the explicit-false rule. Also built: `cacheBehavior.ttl` in every schema, one `resolvePromptCacheTtl`, `ttl` on OpenRouter. Not built: one `resolveCachePolicy`; caching on Vertex, whose chat requests go through the openai-adapters converter (`packages/openai-adapters/src/apis/VertexAI.ts`), which adds no cache markers. | C1         |
| C3  | Toolbar menu, per-model setting in `uiSlice`, warm/expired tooltip, the model/reasoning/mode switch notice, usage-panel additions. **Built** except the usage-panel additions beyond hit rate and 1-hour writes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | C2         |
| C4  | Turn the default on for Claude models with Auto, after C0 data from at least a week of real use shows the hit rate and that Auto's thresholds are sensible. Release note.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | C3         |
| C5  | Docs: update `anthropic.mdx` and `bedrock.mdx` for the new fields, add a short page on cache lifetime and cost. Written to the `docs-style` rules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | C2         |
| C6  | Later: OpenAI `prompt_cache_options.ttl` and `prompt_cache_retention`; keepalive pings; cache-safe compaction; stable system prompt across modes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | C4         |

C0 and C1 are the ones that pay off for a user who changes nothing, so they go first and need no new setting.

### Tests

- C0: fixture streams for Anthropic `message_start` with a `cache_creation` object, and for Bedrock `metadata.usage` with `cacheDetails`, each mapped to `Usage`; cost table tests including a model with a 1-hour write; the "every known Claude model has a price" test.
- C1: the 4.2 case as a regression test (user text, three tool calls, expect `cache_control` on the last tool result and the one before it); string content is converted, not skipped; thinking blocks are never marked; Bedrock messages are byte-identical between consecutive requests apart from `cachePoint` blocks.
- C2: a table test of `resolveCachePolicy` over config, toolbar choice, provider and model; Auto escalation across the 300 s and 3,300 s boundaries with an injected clock; `ttl` omitted for 5 minutes; Bedrock retry without `ttl` on a mocked `ValidationException`.
- C3: component tests for the menu and tooltip, in the style of the existing InputToolbar tests; a redux test that `cacheSettings` persists.
- A manual check, not automated: one Agent session against a real Anthropic key and one against Bedrock, reading `cache_read_input_tokens` and `cacheDetails` for each request. Nothing in this plan has been run against a live API.

## 10. Risks

| Risk                                                                    | Mitigation                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Caching on raises the bill for a short session (125% of no-cache)       | Auto stays on the cheaper 5-minute write until a long gap is seen; the toolbar shows the state; the release note names the switch.                                            |
| A wrong `ttl` fails the request on Bedrock or a gateway                 | Allowlist, one retry without `ttl`, and `ttl` omitted whenever the lifetime is 5 minutes.                                                                                     |
| A gateway at a custom `apiBase` strips the beta header or rejects `ttl` | Per-model override to `5m`; the error text names `cacheBehavior.ttl`.                                                                                                         |
| The prices in the table go stale                                        | "Last checked" date, the every-model-has-a-price test, and the on-screen figure labelled "estimated".                                                                         |
| The Bedrock suffix existed for a reason that removing it breaks         | Ask the author (commit 189d0c87c, `chezsmithy`); C0 data first; keep the change in its own reviewable PR.                                                                     |
| Auto's thresholds are wrong for real sessions                           | They come from eight invented scenarios. C0 logs gaps; C4 waits for data.                                                                                                     |
| Mode switches break the cache more often than expected                  | The notice (section 7) and the miss-cause report (6.5) make it visible; stabilising the prompt is deferred (6.6) until the data says it matters.                              |
| A prompt stays on the provider's side longer with the 1-hour option     | Anthropic says cache entries are held in memory for their lifetime and not stored at rest. The 1-hour option holds a prompt 12 times longer than 5 minutes; the menu says so. |

## 11. Not verified

Run on 2026-11-02 and 03: throwaway code probes (Anthropic `convertMessages` placement, Bedrock message bytes), `prompt-caching-sim.mjs`, and live Bedrock runs (Haiku 4.5, a few cents): cache growth over 5 turns, 5-minute versus 1-hour writes, a 5.5-minute pause, and a two-process isolation check. Everything else is read from code or documentation. No live call was made to the Anthropic API, Vertex or OpenRouter. Still unchecked:

- The Anthropic-path placement fix (tool results get a breakpoint). It is covered by a test of the real request body against a mock, not by a live call. Needs an Anthropic key.
- Whether `anthropic-beta: prompt-caching-2024-07-31` is still needed, and whether `ttl` works through every gateway users put in front of `apiBase`.
- Vertex's support for a 1-hour lifetime, Google's own caching lifetimes (the page came back as HTML), and Nova's behaviour.
- Core `OpenRouter.ts` placement beyond the lines seen in the search results.
- The full text of every paper in 3.5 (abstracts only), and the parts of the Claude Code engineering post that were cut off by the fetch tool.
- Section 5 uses invented session shapes and a model that ignores output tokens, the 20-block lookback, and the real size of a prefix. Auto's thresholds are a guess; the live pause test shows only that 5.5 minutes is enough to lose a 5-minute entry and that a 1-hour entry survives it.
- Bedrock's 1-hour allowlist is read from the AWS table. Only Haiku 4.5 was tried live.
- The UI was tested with component tests, not clicked through in a real editor.

Pages read on 2026-11-02: `platform.claude.com/docs/en/build-with-claude/prompt-caching` and `cache-diagnostics`; `code.claude.com/docs/en/prompt-caching`; `claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything`; `docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching`; `platform.openai.com/docs/guides/prompt-caching`; `openrouter.ai/docs/features/prompt-caching`; and the arXiv search result pages for the papers in 3.5.
