# Research notes: what other tools and vendors do that we do not (second pass)

Read on 2026-11-04. These are documentation reads and code reads, not live tests. Each item says what the
source says, what Continue does now (checked in the fork's code), and what that suggests. Items are numbered
C23 onward in `ROADMAP.md`. Nothing here is built.

## Sources and what they add

| Source                                      | What it says                                                                                                                                                                                                                                                                                                                                                                                                                                | Continue now                                                                                                                                                                                                  | Suggests |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Anthropic, cache diagnostics                | Pass the previous response `id` as `diagnostics.previous_message_id` and the response says where the two requests diverged: `model_changed`, `system_changed`, `tools_changed`, `messages_changed`, with `cache_missed_input_tokens`. "Claude API only: Not available on ... Amazon Bedrock."                                                                                                                                               | Our miss detector hashes model, tools and system itself (`keyChanges`). It has no `messages_changed`: an edited or truncated history is only caught as "the prompt got shorter".                              | C23      |
| Claude Code, `/usage`                       | A "Prompt cache" line: requests, share of input from cache, misses (time of the last, tokens re-cached), "expected rebuilds" (its own compaction or tool-result clearing), and warm or cold with the TTL. "The counts come from the cache token fields in the API's responses, so the line works on every provider."                                                                                                                        | The ring and tooltip show warm or cold. The ledger (C22) holds everything the line needs, but nothing summarises it.                                                                                          | C24      |
| Claude Code, engineering notes and docs     | Run compaction with the parent's exact prefix so it reads the cache. Compaction is a cache-invalidating event it counts separately.                                                                                                                                                                                                                                                                                                         | `compactConversation` sends the history and the summary prompt with no system message and no tools, so its prefix cannot match the conversation's.                                                            | C25      |
| Anthropic, mid-conversation system messages | Available on Amazon Bedrock, on Fable and Mythos, Opus 4.8, 5 and 5.5, Sonnet 5.5, Haiku 5.5. "This feature is not available on Claude Sonnet 5." Sonnet 5.5 and Haiku 5.5 "can treat a system message placed right after a tool result as untrusted text and ignore it". Tool changes by reference (`mid-conversation-tool-changes-2026-07-01`) work on Bedrock; defining a tool inline (`inline-tools-2026-09-15`) does not list Bedrock. | C8 lists four models and does not mention either caveat.                                                                                                                                                      | C26      |
| OpenAI, prompt caching                      | Before GPT-5.6, a stable `prompt_cache_key` routes related requests to one cache ("aim for about 15 requests per minute" per key). GPT-5.6 and later route automatically. Retention: `in_memory` (about 5 to 10 minutes, up to an hour) or `24h`; on GPT-5.6 and later `prompt_cache_options.ttl`.                                                                                                                                          | The adapter forwards a `prompt_cache_key` if given, but nothing sets one.                                                                                                                                     | C27      |
| Google, Gemini context caching              | Implicit caching is on by default for Gemini 2.5 and later; minimum 2,048 tokens (2.5) or 4,096 (3.x and 4). On Gemini 4 the full previous request is cached only if the new one adds at least 2,050 tokens. Hits are reported in `usage.total_cached_tokens`.                                                                                                                                                                              | The types carry `cachedContentTokenCount`; `packages/openai-adapters/src/apis/Gemini.ts` maps `promptTokenCount`, `candidatesTokenCount` and `totalTokenCount` and nothing else, so a cache hit is invisible. | C28      |
| Claude Code, lifetimes                      | It decides the lifetime per request in two buckets: the main conversation, and "everything else" (subagents, compaction, titles), which stays at 5 minutes by default.                                                                                                                                                                                                                                                                      | One policy for the conversation. Subagents (beta in the CLI) were not checked.                                                                                                                                | C29      |
| Anthropic, prompt caching                   | "A cache entry only becomes available after the first response starts." For parallel requests, wait for the first response.                                                                                                                                                                                                                                                                                                                 | Not checked for parallel tool calls or subagents.                                                                                                                                                             | C29      |
| Claude Code, hooks and status line          | A `PreModelSwitch` hook can confirm or block a model switch; a `prompt_cache` object is exposed to status line scripts.                                                                                                                                                                                                                                                                                                                     | Hooks D1 to D3 are wired; no cache-related event.                                                                                                                                                             | C30      |
| Aider, caching                              | `--cache-keepalive-pings N` pings every 5 minutes, up to N times after each message.                                                                                                                                                                                                                                                                                                                                                        | Deferred (a gain of 1.3% at best in our data).                                                                                                                                                                | none     |

What the research confirmed and did not change: Claude Code's list of actions that break the cache (model
switch, effort change, fast mode, MCP server or plugin changes, denying a tool, compaction, many images) is
mostly what `useWarmCacheNote` and the switch notices already cover. One nuance: on Opus 5.5, Sonnet 5.5, Haiku
5.5 and Fable 5.1 with an API key, changing effort keeps the cache; on Bedrock it does not.

## Proposed items

Sized small (a day or less), medium (a few days) or large. Each names what to check before building. None is
built.

### C23: add a `messages changed` cause to the miss detector (small)

Anthropic's diagnostics distinguishes four causes. Ours reports model, tools and system, and treats a shorter
prompt as "history was cut" without saying so as a cause. A `messages_changed` cause (a message earlier than
the newest was edited, reordered or removed) is the one a user can act on: it usually means an edit or a
regenerate. Hash each message the way `promptCacheKey` hashes the system prompt, keep the list in the key, and
report the first index that differs.

- Not available from the API on Bedrock, so this stays a local check and cannot be replaced by the server.
- Check first: whether regenerating a reply or editing an earlier message changes the bytes we send, and
  whether the per-process ID on the first user message (Bedrock) makes the first message's hash differ.
- Tests: edit, regenerate, delete, compaction (should say compaction, not a fault), pruning.

### C24: a one-line cache summary in the usage panel (small)

Claude Code shows requests, hit share, misses with the time of the last and tokens re-cached, expected
rebuilds, and warm or cold with the TTL. Every number is already in the C22 ledger. This also gives C17 (cost
of lost caches) somewhere to live. Treat compaction and a model switch the user chose as "expected rebuilds",
as Claude Code does, so they are not counted against the cache.

- Check first: that the ledger's miss causes separate an expected rebuild from a fault; today `missCauses`
  holds the cause text only.
- Tests: a recorded ledger with a miss, a compaction and a switch gives the right counts; no ledger gives no line.

### C25: make compaction read the cache (medium)

`compactConversation` (`core/util/conversationCompaction.ts`) sends the history plus the summary prompt with
no system prompt, no tools, and an empty options object, so it passes no `promptCaching` at all. Unless the
model's config turns caching on, the request has no cache points: it neither reads the conversation's cache
nor writes one, and pays the full input price on a conversation that is, by definition, large. Even with
caching on in config, its prefix (no system prompt, no tools) cannot match the conversation's. Anthropic's
own tool sends the parent's exact prefix. Sending the same system prompt and tool list, with the summary
request as the final user message and the conversation's cache setting, should read the cache the
conversation already has.

- Check first, live: how many tokens a real compaction reads and writes today against the same request
  with the parent's prefix. This is the measurement that decides it, a few cents on Bedrock.
- Risk: tools in the request mean the model may try to call one instead of summarising; the request needs
  `toolChoice` none or an instruction, and the result must be text only.
- Depends on: C16 for the CLI path; the GUI path is `core/util/conversationCompaction.ts`.

### C26: add the caveats to C8 before building it (small, docs only)

C8 plans to send rule changes as an appended system message. The documentation adds three constraints that
change the plan: it is not available on Sonnet 5 even though Sonnet 5.5 has it; Sonnet 5.5 and Haiku 5.5 may
ignore a system message placed right after a tool result, so the instruction should go in the user turn on
those models; and a system message cannot be the first entry. Update C8 with these and a per-model table
before anyone writes code.

### C27: OpenAI cache key and retention (small)

Before GPT-5.6, a stable `prompt_cache_key` per conversation helps route requests to one cache; the adapter
forwards one but nothing sets it. For GPT-5.6 and later OpenAI routes automatically and the key is not needed.
A conversation ID is a reasonable key, with the privacy note from OpenAI that separate keys also prevent
cache-hit probing across users. Retention (`prompt_cache_retention`, or `prompt_cache_options.ttl` on 5.6
and later) has no setting at all.

- Check first: that setting a key does not change behaviour on models that ignore it, with one live request
  on a direct OpenAI key (not Bedrock, where the adapter is different).
- Not for Bedrock: OpenAI models there cache implicitly and Converse takes no key.

### C28: read cached tokens for Gemini (small)

Gemini caches implicitly from 2,048 tokens (2.5) or 4,096 (newer) and reports hits in
`usageMetadata.cachedContentTokenCount`. The type exists in the repo and nothing maps it into `Usage`: the adapter
(`packages/openai-adapters/src/apis/Gemini.ts`) reads the three plain counts, and `core/llm/llms/Gemini.ts` has no
usage handling that a search found, so a Gemini user sees no usage, hit rate or cost saving at all. Map it into `promptTokensDetails.cachedTokens`, and add the
minimum to `cacheMinimums.ts` so the status can say "nothing cached yet".

- Check first: whether Gemini's prompt count includes the cached tokens (it does in OpenAI's convention), so
  `promptTokensExcludeCache` must say false for it. A wrong answer double counts.
- Prices are not in the cost table for Gemini; the hit rate is useful without them.

### C29: lifetime per kind of request (medium)

Claude Code picks a lifetime per request in two buckets: the main conversation, and everything else
(subagents, compaction, titles), which stays at 5 minutes. A subagent or a title request that inherits the
conversation's 1-hour setting pays the 2x write for an entry that is read once. Also, "a cache entry only
becomes available after the first response starts": parallel subagents that share a prefix will each write it.

- Checked: title generation (`core/util/chatDescriber.ts`) calls `model.chat` with the model's own options, so it
  caches only if the model's config does, and it would take the conversation's lifetime if one were set there.
- Check first: what subagents send today (`tools/subagent.ts`, `subagent/executor.ts` were not read).
- Depends on: F6 (subtasks) for the design; the title and compaction requests can be done on their own.

### C30: cache events for hooks and a script-readable summary (medium, later)

Claude Code exposes a `PreModelSwitch` hook and a `prompt_cache` object for status-line scripts. Our hooks
(D1 to D3) have no cache event. A `PreModelSwitch` hook is small once the model switch has a single point; the
summary object is the C24 data in JSON. Lower priority than C23 to C25 because it serves a few users.

## Order

| Order | Item     | Why                                                                             |
| ----- | -------- | ------------------------------------------------------------------------------- |
| 1     | C26      | Docs only, and it prevents building C8 wrong                                    |
| 2     | C23, C24 | Small, local, and C24 is where C17 lands                                        |
| 3     | C25      | The only item here with a likely large saving; needs one live measurement first |
| 4     | C28, C27 | Reach people on other providers; each needs one check                           |
| 5     | C29      | Needs the subagent code read first                                              |
| 6     | C30      | Later                                                                           |

## Not worth doing, and why

- **Keepalive pings** (Aider's `--cache-keepalive-pings`): still 1.3% at best for a large number of extra
  requests in our data; Aider's own docs note the cost is paid on every ping.
- **Anthropic cache diagnostics as a feature:** it is Claude API only, not Bedrock, and Bedrock is the
  provider this fork is built around. C23 does the useful part locally.
- **Explicit `prompt_cache_breakpoint` for GPT:** AWS says Converse does not support it for these models.

## Status

C26 is done (conditions in `cache-safeguards.md`). C23 and C24 are built on `feat/cache-messages-changed` (`43bc71e10`, local), stacked on `feat/cache-ledger`.

- C23: the cache key carries a checksum per message after the system message. Usage, metadata and IDs are left out, since they are attached after a message is sent. `keyChanges` names the first earlier message that differs, which covers an edit, a regenerated reply and a removal. A conversation that only grew is not a change. A test builds the key from real `constructMessages` output, so context items are covered too.
- C24: `summarizeLedger` and `formatCacheSummary` produce the line, and the cache button tooltip shows it as "This session: ...". It is in the tooltip, not the usage panel, because the console window has no Redux store.
- Known gap in C24: the ledger only records requests the miss detector reported. That detector says nothing for a model-only switch or a compaction (a shorter prompt), so neither appears as an expected rebuild. Fixing it means recording them in the thunk. Claude Code counts both.
- Not checked: how the tooltip reads on screen. The tests cover the text builders and the key, not the portal.

C31 to C33 are built on branches stacked above `feat/cache-messages-changed` (local): `feat/cache-expected-rebuilds`, then the failure list and the throttling tip. C31 closes the gap noted under C24: model switches and compactions are now counted as expected rebuilds. Vendor wording behind C33: AWS says a request's quota use is its uncached input plus its cache writes plus its output times a burndown rate, with cache reads left out; Anthropic says cache hits are not deducted from its rate limit; OpenAI says cached tokens still count toward its limits. Nothing read says a global endpoint is throttled less, so the tip does not say it. The tip is measured on no real throttled session.

## Live results, 2026-11-04

Four live checks on Bedrock, all small, on Haiku 4.5 and Haiku 5.5. Each prints token counts only.

**The adapters send `ttl` (C16).** The built Bedrock adapter, configured with `cacheBehavior.ttl: 1h`, sent two requests with a shared 4.5k-token prefix. The first wrote 4,532 tokens, all reported under `1h` in `cacheDetails` and none under `5m`. The second read 4,495 and wrote 37, again under `1h`. So the adapter's cache points carry the lifetime, Bedrock accepts it on Haiku 4.5, and the new `cacheDetails` mapping fills the per-lifetime split. Not run: the Anthropic adapter's 1-hour `cache_control`, which has no credential here.

**What the app records matches the invocation log (C35, in part).** Both requests were found in the invocation log by their time and token counts: the log shows the same 4,532 written, then 4,495 read and 37 written, with 3 uncached input and 5 output tokens each. The adapter does not surface the request ID, so the match is by counts and timing, not by ID. This confirms the token counts the ledger is built from. It does not test the replay's cost projection: the invocation log has no prices, and Cost Explorer lags by a day. The replay against a real bill remains open.

**Converse accepts a `system` role in `messages`, with conditions (C8).** Haiku 5.5 rejected it three ways and accepted it once. The accepted shape was `user, system, assistant, user`: the request returned 200 and the reply followed the system message's instruction. The errors state the rule: a system message with content must immediately follow a user turn and must precede an assistant turn or end the array, which is what Anthropic's page on mid-conversation system messages says. So `user, system` (the last turn must be a user message on this model) and `user, system, user` (a system message must be followed by an assistant turn) both fail. It also rejected `temperature` outright ("deprecated for this model"). The placement rule matters for C8: an appended system message can only go where an assistant turn follows it, so it is not simply "append to the end". Not tested: whether such a message keeps a cache prefix alive, which is the point of C8.

**Compaction reads the cache if it sends the parent's prefix (C25).** One synthetic conversation of about 12k tokens, with a system prompt, a tool and three turns:

| Request                                                    | Uncached | Read   | Written |
| ---------------------------------------------------------- | -------- | ------ | ------- |
| The parent's own turn (writes the cache)                   | 3        | 0      | 12,181  |
| Compaction as it is today: history and summary prompt only | 8,598    | 0      | 0       |
| Compaction with the parent's system, tools and cache point | 26       | 12,181 | 0       |

At Haiku 4.5 prices that is roughly seven times cheaper for the compaction request (the second row pays full input price on 8.6k tokens; the third pays the read price on 12.2k and full price on 26). The caveat decides the design: this holds only while the parent's cache is warm. With it cold, sending the parent's prefix would write 12k tokens at the write price to a cache the compaction is about to make useless, which costs more than today's plain request. The cold-cache notice offers "Compact first" exactly when the cache is cold, so C25 as written helps the case least in need of it. Not tested: whether the model calls the tool instead of summarising (output was capped at 200 tokens and both stopped on the cap), and a real conversation.

Total cost of all four checks: a few cents.

## C41: Anthropic's automatic caching, evaluated 2026-11-04

Source: Anthropic's prompt caching page (read in full for this section; nothing was run).

**What it is.** One `cache_control` field at the top level of a Messages request. "The system automatically applies the cache breakpoint to the last cacheable block and moves it forward as conversations grow." It takes a 1-hour lifetime the same way (`ttl: 1h`). It is supported on all active Claude models. Pricing, minimum token thresholds, ordering rules and the 20-block lookback window are the same as for explicit breakpoints.

**How it combines.** It uses one of the four breakpoint slots. With four explicit breakpoints already on the request, the API returns a 400; so does an explicit breakpoint on the last block with a different lifetime. If the last block cannot take a breakpoint it walks backward to the nearest one that can.

**Where it is available.** "Every platform except the legacy Amazon Bedrock (Opus 4.6 and earlier) integration", where a top-level `cache_control` returns a 400. That page describes Anthropic's own Bedrock Messages integration. The Converse API this app uses on Bedrock sends `cachePoint` blocks, and nothing read says Converse has a top-level equivalent.

**What this app does today.** It places up to four explicit breakpoints: the last tool, the system prompt, and the last block of each of the last two user messages. The code's reason for two (`anthropicCache.ts`): the second to last is where the previous request wrote its entry, so this request can read it, and the last is where this request writes. That is the same job automatic caching does by moving one breakpoint forward, at the price of a second slot.

**Assessment: do not adopt.**

- It would replace two message breakpoints with one moving breakpoint. That frees a slot and does the same read-then-write job, so the saving is one of the four slots and the simplicity of having no markers to place. Neither is worth a second code path: the markers are placed in one function now, for the app's own tool-loop shape (where the last blocks are tool results), and Anthropic's page itself says to use an explicit breakpoint when the last block changes on every request.
- It is not available on the Bedrock path at all, which is where the app has the most caching work, so it could only ever be an Anthropic-direct option and would make that path differ from Bedrock.
- The gain is simplicity (no markers to maintain), and the app already maintains them in one place.

**Revisit if** Converse gains a top-level equivalent, or if measurement shows the second message breakpoint rarely produces a read the first would not have.

## C25 built, 2026-11-04

Built on `feat/compaction-reads-cache` (local). The chat window sends the conversation's own request, built by the same function the chat uses, with the summary prompt appended, but only when all of these hold: caching is on, the entry is still warm, the whole conversation is being compacted (a shorter prefix does not end at a breakpoint), the target has no summary of its own, and the last request was neither pruned nor still streaming. Otherwise the request is exactly what it was. The options carry the lifetime the last request wrote with, not what Auto would pick now. A test removes the warm check and four others fail.

Live check through the built Bedrock adapter on Haiku 4.5, with the same message shapes the code builds (not through the GUI or core code path, which unit tests cover): the parent turn wrote 12,208 tokens; the summary request with the prefix read 12,208, wrote 23 and answered in text; the plain summary request paid 8,622 uncached tokens.

The tool-call risk: the tools stay in the request because they are part of the cached prefix, and nothing can forbid calling one (`toolChoice` can only force a named tool, and the Bedrock provider does not send it). So the summary prompt carries a note to answer in text, and a reply with no text falls back to the old request. The run answered in text. Not tested: a model that chooses a tool anyway, and a real long conversation.

## Audit of C0 to C10, 2026-11-04

Each row's claim was checked against the code and the vendors' pages, not against the earlier plan text. "Verified" below means I found the code and, where noted, a test; it does not mean I have seen the feature in a running UI.

| Row | Status                                                       | What was checked                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C0  | Done in part                                                 | Bedrock usage is mapped (core and the adapter), the 5m/1h split is in `Usage` and priced, the 1-hour price is in the table, and the usage panel shows cache read, write (with a 1-hour count) and hit rate. Fable 5, Fable 5.1, Mythos 5 and Mythos 5.1 had no price and were added (`0bcbbfad3`). Not there: a miss-cause report in the usage panel (the causes are in the tooltip and the copied record). |
| C1  | Done, with one fix                                           | `core` marks the last two user-role messages including tool results (`markCacheBreakpoints`), and Bedrock puts its process ID on the first user message only. The Anthropic adapter, which the CLI uses, still marked only text blocks, so an agent loop got no marker on most turns. Fixed with tests (`e466432c6`). A string-content user message is now counted too, which stops a fifth breakpoint.     |
| C2  | Done for Anthropic and Bedrock, not for Vertex or OpenRouter | `ttl` is sent by `core` and by both adapters. `core`'s Vertex and OpenRouter providers and the adapters' Vertex and OpenRouter paths send no `ttl` (the toolbar button is hidden for them). One policy function exists for the chat window; the adapters carry a small counter for the CLI.                                                                                                                 |
| C3  | Done                                                         | The menu offers Auto, 5 minutes, 1 hour, Off and Config; the tooltip says warm or expired with time left; model and mode switch notices exist (`ModelSwitchCacheNotice`, `ModeSwitchCacheNotice`); the usage panel shows cache read and write and the hit rate.                                                                                                                                             |
| C4  | Open, the owner's call                                       | Caching is still off unless config or the toolbar turns it on (`configEnablesPromptCaching`). C15 is the narrower version.                                                                                                                                                                                                                                                                                  |
| C5  | Done                                                         | `prompt-caching.mdx` covers the fields, lifetimes, cost, the toolbar, the summary, tips, notices, Bedrock and what is not supported; `reference.mdx` documents `promptCaching`, `cacheBehavior` and `ttl`. The reference text for Auto was out of date (it lacked the request-5 rule) and was corrected.                                                                                                    |
| C6  | Done                                                         | Every safeguard it lists exists: cold-cache notice, caching-off notice, model and mode switch warnings, miss notice, large-message notice, the context meter and the Claude 5 prices. "Global Bedrock hint (PR to follow)" is now the regional-premium tip (C21) with C34's check.                                                                                                                          |
| C7  | Open                                                         | A saved session that has no cache record gets no cold-resume notice (`coldResume` returns nothing without `lastRequestAt` and an input size), and the large-message notice does not count @-attached files (its own comment says they are fetched at send time). Neither changed.                                                                                                                           |
| C8  | Open                                                         | Measured: Converse accepts a `system` role in `messages` on Haiku 5.5 only where an assistant turn follows it. Unbuilt.                                                                                                                                                                                                                                                                                     |
| C9  | Open, and the premium is unconfirmed                         | Vertex and OpenRouter share the Anthropic price table, so Claude 5.x is priced for them at list price. The Google Cloud regional premium could not be confirmed: Google's pricing page does not list Claude at all, Anthropic's page links to a Google page that states no premium, and the Claude page on Google's docs says nothing about price. Nothing is applied.                                      |
| C10 | Open                                                         | No tool-result clearing, no compaction suggestion and no "spent on cold rewrites" line exists. The usage panel shows a session total cost; the toolbar does not.                                                                                                                                                                                                                                            |
| C13 | Open                                                         | `escalatedBy` is saved with the session and shown in the tooltip, but it is not in the local dev data log (`chatInteraction` has no cache fields).                                                                                                                                                                                                                                                          |

Three rows were wrong in a way that mattered: C1's adapter gap (a real bug in the CLI path), C0's missing Fable and Mythos prices, and C5's stale Auto description. All three are fixed above.
