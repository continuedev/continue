# Plan: session cost and context-window display

Status: PR 1 of 1. Written 2026-11-04 against `origin/main` 010fa2c86. Roadmap item "Context-window and cost display per model" (`ROADMAP.md`, Later; `fork-plan.md` 4.7 item 4).

## 1. Problem

The chat shows no running total of what a session has used. The only numbers are a context bar that appears at 60% and the LLM log console, which keeps its totals in memory and shows them for the whole log, not for one chat. You cannot see how many tokens were read from the cache, what the session has cost so far, or how close the conversation is to the model's window.

## 2. What exists

- `Usage` on the final assistant chunk, filled by providers (`promptTokens`, `completionTokens`, cache read and write counts). Claude providers report input without the cached part, OpenAI-style providers include it; `core/llm/utils/cacheStats.ts` (`totalInputTokens`) already normalises this.
- `calculateRequestCost` and the price table (Track C, #126/#127). It returns `null` for a model it has no price for.
- `Session.usage?: SessionUsage` in `core/index.d.ts`, and `HistoryManager.save` already writes it. Nothing filled it.
- `ModelDescription.contextLength`, resolved in core from the config or `packages/llm-info`.

## 3. Design

- Pure math in `core/llm/utils/sessionUsage.ts`: `addRequestUsage` folds one request into the session totals, keyed per `provider/model`; `summarizeSessionUsage` sums models; `contextUsage` is the latest request's tokens against the window; formatters.
- Per model the totals hold fresh input, output, cache read, cache write, cost of the priced requests, and how many requests were priced.
- **No fake cost.** A model without a known price adds tokens and no cost. If no request was priced the summary has `cost: undefined` and the UI says "tokens only". If some were, the UI says "at least $X".
- Context use is the latest request's input plus output, because that is what the next request will carry at minimum. The window comes from the matching entry in `modelsByRole.chat`; unknown window shows the token count alone.
- Stored per session: `state.session.usage` is reset by `newSession`, restored from `Session.usage` on load, and sent with `history/save`. Nothing global. No new protocol message is needed because `history/save` already carries `Session`.
- UI: `UsageIndicator` in the input toolbar next to the cache button. A thin bar with percent and cost; the tooltip lists context, session tokens, cache tokens, the cost note and a line per model when more than one was used.

## 4. PRs

One PR: math + tests, session state, save and restore, indicator, this plan.

## 5. Tests

- `sessionUsage.vitest.ts`: Claude and OpenAI cache accounting, unpriced model gives tokens and no cost, partial cost flag, accumulation without mutation, context fraction and cap, formatting.
- `UsageIndicator.test.tsx`: hidden before usage, percent and cost for a priced model, no `$` for an unpriced one, reset and restore across sessions.

## 6. Not done

- Requests made outside the chat stream (title generation, compaction, edit mode) are not counted.
- Prices are list prices and only Anthropic-family and some OpenAI models are priced; other providers show tokens only.
- The older LLM log console totals are unchanged.
