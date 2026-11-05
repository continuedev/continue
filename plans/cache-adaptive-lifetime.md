# Plan: Auto escalates on the conversation (C11, C12)

Status: planned, nothing built. Written 2026-11-03 against branch `feat/cache-countdown` (on top of
`feat/cache-safeguards-main`). Evidence is in [`cache-real-world-data.md`](./cache-real-world-data.md).
Parent plan: [`prompt-caching.md`](./prompt-caching.md) section 6.3.

## Summary

Auto starts every request on the 5-minute lifetime and switches to 1 hour for the rest of the session
after it sees one gap of 5 to 55 minutes. The gap that triggers it has already cost a full rewrite. Two
changes, measured on a week of real agent traffic:

1. Stop carrying `escalated` from one conversation into the next. Worth +0.8% on its own.
2. Also escalate at the fifth request of a conversation, in agent-style modes. Worth -3.8% on top, and
   only if (1) is done: with the carry-over kept, the two together come out at +0.2%.

Nothing else in this plan changes what the user sees except one line of help text and the tooltip.
Auto is not the default today, so only people who chose it, or set `cacheBehavior.ttl: auto`, are affected.

## Evidence

Claude conversations, input-side cost at the billed rates, week of 2026-10-26, rebuilt from cache counts
(5,708 conversations). "Reset" is Auto starting each conversation on 5 minutes.

| Policy                                                               | Cost vs reset |
| -------------------------------------------------------------------- | ------------: |
| Auto with the carry-over, never forgotten (what the app does)        |         +0.8% |
| Same, forgotten after 1 day idle / 1 hour idle                       | +0.8% / +1.0% |
| Reset + escalate at request 5                                        |         -3.8% |
| Carry-over + escalate at request 5                                   |         +0.2% |
| Carry-over (1 day) + escalate at request 5                           |         +0.1% |
| Per-conversation best of 5 min and 1 h, with hindsight (unreachable) |         -6.3% |

- Escalating at request 3 to 15 gives -2.9% to -4.4% in each of four weeks, so the exact number is not fragile.
- At request 5, 1,346 conversations pay less (about 60 cents each), 2,003 pay more (about 16 cents each,
  the 1-hour premium on writes never reused) and 2,359 are unchanged.
- Why the carry-over hurts: it starts single-call and short conversations on the 1-hour write, which costs
  60% more than the 5-minute write when nothing reads it again.
- Why a count works: of conversations that reach 5 requests, 43% later pause 5 to 55 minutes; of those
  reaching 50, 58%.
- Learning a person's habits from history gained nothing (+0.2%), and keepalive pings gained 1.3% at best
  for 71,000 extra requests. Neither is in this plan.

The data is agent traffic from other tools. In their logs a request is usually a tool step. In Continue's
Chat mode a request is a human turn. The proposal therefore counts requests only in agent-style modes.

## What the code does now

- `gui/src/util/promptCache.ts`, `resolvePromptCache(model, setting, state, now)`: sets `escalated` when
  `now - state.lastRequestAt` is above `AUTO_ESCALATE_MIN_GAP_MS` (5 min) and at most
  `AUTO_ESCALATE_MAX_GAP_MS` (55 min). Returns the options for the request and the next state.
- `PromptCacheSessionState` holds `escalated`, `lastRequestAt`, `lastTtl`, `lastInputTokens`, the key of the
  last request, and miss and notice bookkeeping. It is Redux state in the window, not persisted.
- `sessionSlice.newSession` rebuilds the state from `INITIAL_PROMPT_CACHE_STATE` but copies `escalated` from
  the previous conversation, with a comment saying what Auto learned about the user's pauses carries over.
  A loaded session also restores `lastRequestAt`, `lastInputTokens` and `lastTtl` from the saved record.
- `streamNormalInput.ts` calls `resolvePromptCache` once per request, including every request that follows
  a tool result (`streamResponseAfterToolCall` dispatches `streamNormalInput` again). So a tool loop counts
  one request per model call, which is what the logs count.
- `saveCurrentSession` persists `lastRequestAt`, `lastInputTokens` and `lastTtl` only.
- `session.mode` is `chat`, `agent`, `plan` or `background`.
- The CLI sends no cache settings that I could find (no `promptCaching`, `promptCacheTtl` or `cache_control`
  under `extensions/cli/src`), so this plan is GUI only.

## Design

### Rule

```
before each request, with caching on and the setting "auto" (or config ttl "auto"):
  gap = now - lastRequestAt
  if lastRequestAt && 300 s < gap <= 3300 s:   escalated = true      // today's rule, unchanged
  requests = requests + 1                                            // new: requests this conversation
  if mode is agent-style and requests >= ESCALATE_AT_REQUEST:  escalated = true     // new
  ttl = escalated ? "1h" : "5m"
```

- `ESCALATE_AT_REQUEST = 5`. The measured curve is flat from 3 to 15 (-2.9% to -4.4% in each of four weeks), so
  5 is a point on a plateau and not a tuned value. It is one exported constant.
- "Agent-style" is `agent`, `plan` and `background`, the modes that send tools (`selectActiveTools` returns
  nothing in `chat`). In `chat` the rule does not apply: a request there is a human turn, and no data shows
  what five human turns predict. Chat keeps today's gap rule only.
- The count is of requests the rule has seen. `newSession` resets it to 0, and the saved record keeps it (C12)
  so a resumed conversation does not start counting again from 0.
- Escalation is sticky within a conversation, as today.

### Carry-over (C11a)

`newSession` stops copying `escalated` from the previous conversation. Each conversation starts on 5 minutes
and earns the 1-hour lifetime from its own requests. A resumed session restores its own flag (C12), not the
last window's.

Replaying the app's actual carry-over cost +0.8%, and it cancels the count rule when both are on (+0.2%
against -3.8%). So C11a ships first and on its own, and C11b (the count) is not worth shipping without it.

### State

`PromptCacheSessionState` gains `requests: number` (default 0) and `escalatedBy?: "gap" | "requests"`.
`SessionPromptCache` gains `requests?` and `escalated?` so a resume can restore both. Both are optional on
disk: a session saved before this has neither and behaves as a new conversation.

### UI

- Auto's help text becomes "5 minutes, then 1 hour once a conversation has made 5 requests or you pause 5 to
  55 minutes". The text lives in `PROMPT_CACHE_SETTING_LABELS.auto.detail`, and `promptCacheTooltip` already
  says "Auto (5 minutes)" or "Auto (1 hour)".
- The tooltip also says why Auto switched: "Auto switched to 1 hour after 5 requests", or "after a pause of N
  minutes". The reason is `escalatedBy`. No notice, no badge.
- The countdown ring is unchanged; `lifetimeMs` already follows `lastTtl`.

### Not in this plan

- Learning from a person's history (no gain, +0.2%).
- Keepalive pings (-1.3% at best, 71,000 extra requests, a read refreshes the lifetime, confirmed live).
- A context-size trigger (weaker, -1.8%) and an age trigger (as good as the count, -3.9% to -4.1%, but it
  fires at the second message in chat). The count is chosen because it is simpler to explain and to test.
- Changing the default from "off" or "config". That is C4 and the owner's decision.
- The CLI: it sends no cache settings today.

## Work breakdown

| PR   | Scope                                                                                                                                                            | Depends on | Risk                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| C11a | `newSession` stops carrying `escalated`; a test per path that creates a session (new, load, compact, switch). Help text unchanged                                | C6         | Low. Auto users lose the head start the carry-over gave a second conversation, which the data says cost 0.8%    |
| C11b | `requests` and `escalatedBy` in the state; the count rule in `resolvePromptCache` with a `mode` argument; `ESCALATE_AT_REQUEST`; help text and tooltip; tests    | C11a       | Medium. A billing change for people on Auto: long conversations pay 60% more per write and stop paying rewrites |
| C12  | `requests` and `escalated` in `SessionPromptCache`, written by `saveCurrentSession`, restored by `newSession`; the cold-resume notice uses the restored lifetime | C11b       | Low. Old sessions have neither field                                                                            |

## Tests

Existing: `promptCache.resolve.test.ts` (14), `promptCache.configTtl.test.ts` (5), `promptCache.status.test.ts`
(20), `promptCache.switch.test.ts` (6), and `sessionSlice.test.ts`.

- C11a: a new conversation after an escalated one starts on `5m`; loading a saved session restores its own
  record and not the previous window's; compaction clears the record (it already does). The existing
  `gui/src/redux/slices/sessionSlice.test.ts` asserts the opposite today (`escalated: true` kept across
  `newSession`, around lines 25 to 53), so those cases change on purpose and the PR says so.
- C11b, in `resolvePromptCache`:
  - requests 1 to 4 in `agent`: `5m`; request 5: `1h`; request 6: still `1h`.
  - the same sequence in `chat`: `5m` throughout.
  - the gap rule still fires first when it applies, and `escalatedBy` says `gap`.
  - settings `5m` and `1h` ignore the count; `off` and an unsupported model do not count.
  - a model that cannot take 1 hour stays `5m` and the count does not corrupt `lastTtl`.
  - config `ttl: auto` follows the rule; a fixed config ttl ignores it.
  - one count per model call, including each call after a tool result: a thunk-level test with a mocked tool
    loop of 6 calls (`streamResponseAfterToolCall` dispatches `streamNormalInput` again for each).
- C12: save and load round trip; a record with neither field.
- Component tests: the tooltip text for each reason; the help text.
- Live (AWS, a few cents): extend `Bedrock.cache.live.vitest.ts` to run 6 turns with the app's own
  `resolvePromptCache` choosing the lifetime, wait 6 minutes after turn 5 and check that turn 6 still reads
  from cache. It shows the switch produces a 1-hour entry that survives; it cannot show a saving.

## Open questions

| Question                                                 | Why it matters                                                                                   | How to settle it                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Is 5 right for Continue's Agent mode?                    | The data is other tools' requests. A Continue agent turn may make more or fewer per human prompt | C13 on a week of our own use, before C4                                               |
| Does Chat deserve a count (for example 5 messages)?      | The parent plan's chat rows said 1 hour wins there                                               | The same C13 log, split by mode. Until then Chat keeps the gap rule only              |
| Does the carry-over help someone who reopens the window? | The replay cannot see window reloads; it treated each chain as a new conversation                | C13 logs escalation by conversation start                                             |
| Do Haiku and OpenAI-on-Bedrock models behave?            | OpenAI models have no 1-hour tier; Haiku 4.5 may not take `ttl`                                  | `modelSupportsOneHourCache` guards the lifetime; the count must not claim `1h` unsent |

## Rollout

Auto is opt-in today, so the changes reach only people who chose it. Release notes say Auto now moves to 1
hour sooner, which raises the write price of long conversations by 60% and removes the rewrites after
pauses, and that the toolbar menu sets it back to 5 minutes. After C13 has a week of local data, revisit the
threshold and C4.

| C13 | Log `escalatedBy`, the request number at escalation and the hit result of the next request, per session, in the existing dev data (C0) | C11b | Low. Local only |

Order: C11a, C11b, C12. C13 can land with C11b. Each is its own PR.

## Status

C11a, C11b and C12 are built on `feat/auto-request-count` in the fork (`41dec094f`, local). `newSession` no longer copies `escalated`. `resolvePromptCache` takes the mode, counts one request per model call, and escalates at `AUTO_ESCALATE_AT_REQUEST = 5` in agent, plan and background modes only; the count, the escalation and its reason (`escalatedBy`) are saved with the session and restored on resume, and old sessions start counting from zero. The tooltip says why Auto switched. The full GUI suite (801 tests) passes, including a thunk test that drives the real request path for the 4th and 5th request, chat mode, and caching off; `sessionSlice.test.ts` changed on purpose. Not checked in a running window. The open questions below are unchanged: the threshold is the other tools' plateau, not Continue's own data, and C13 is what would settle it.
