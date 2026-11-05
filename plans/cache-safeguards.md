# Cache and cost safeguards

Which expensive mistakes the app can warn about, what it says, what it offers instead, and what is built. Companion to [`prompt-caching.md`](./prompt-caching.md).

## Rules for a warning

- Say nothing on the fast path. Most requests follow the previous one within two minutes.
- Warn before the money is spent, while the user can still choose.
- Name the cost in tokens and, when the model is priced, dollars. Say what each offered action costs, including that compacting reads the whole conversation once at full price.
- One dismissible line, never a dialog, except for a model switch, which is a deliberate act.
- Offer the cheaper way: a new session, compaction, or a longer cache lifetime.
- Every threshold is a constant in `gui/src/util/cacheSafeguards.ts` so it can be tuned from real use.

## Evidence

- **Documented**: Anthropic's pages on [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows), [context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing), [pricing](https://platform.claude.com/docs/en/about-claude/pricing), and Claude Code's [prompt caching](https://code.claude.com/docs/en/prompt-caching) and [cost](https://code.claude.com/docs/en/costs) pages, read 2026-11-03.
- **Measured**: a one-off, by-hand look at one developer's request timelines from two other coding agents, plus an AWS account's billing and CloudWatch data. The scripts are not in this repository and Continue never reads another tool's history. One developer with unusually long sessions (contexts to 1M tokens), so use the numbers to pick thresholds, not as typical frequencies.

Measured findings:

1. Pauses are short. The median gap between requests is 13 to 15 s and 92% of gaps are under 2 minutes. Gaps of 5 to 55 minutes are about 3%.
2. Auto and always-1h cost about the same (replayed cost 18.4% and 18.6% below 5-minute writes). Whether caching is on matters far more: no cache cost 7 to 9 times the 5-minute replay.
3. Context size is the cost. Requests over 200k tokens were 81% of one agent's requests and 90% of its cost.
4. Cold resumes onto a 50k+ context carried 10 to 13% of billed cost. For the agent that wrote 5-minute entries, 70% of that came from pauses of 5 to 15 minutes, which a 1-hour cache covers.
5. Some misses are tool bugs: one agent left over 10k tokens uncached on 74% of in-window requests, and on 79% of the ones started by a tool result.
6. Compacting at a cold resume beat continuing in 90 to 100% of cases, but the saving comes from the later messages. The compaction request itself reads the whole conversation.
7. A notice per large tool result would fire 14 times a day for 8% of context growth. Not worth it.
8. On Bedrock, a Regional ("us.") profile bills 10% above the global one for the same model: Cost Explorer shows $2.00 and $2.20 per million input tokens for Sonnet 5.5.

Documented, and matching the billing: Claude Haiku 5.5 is priced by prompt length. A request over 100,000 tokens (cache reads and writes included) pays 5 times the input, output, read and write prices on every token of that request. 97% of one account's Haiku 5.5 cost sat in `long_ctx` usage types.

## Gotchas

| #   | Gotcha                                                                                                   | What the user sees                                                                                                                                                  | Offers                                                | Evidence                | Status                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Cache expired, large conversation, next message re-reads it                                              | Line above the input: "Prompt cache expired 12 min ago. Sending re-reads 366k tokens at full price (about $1.26 more)."                                             | Compact first, New session, Use 1 hour cache, Dismiss | Documented, measured    | Built                                                                                                       |
| 2   | Switching model starts an empty cache                                                                    | Confirmation naming both models and the cost, only above $0.25                                                                                                      | Switch anyway, Switch in a new session, Cancel        | Documented              | Built                                                                                                       |
| 3   | Switching mode changes the system prompt and tools                                                       | One line in the mode menu while the cache is warm                                                                                                                   | informs                                               | Documented              | Built                                                                                                       |
| 4   | Toggling reasoning rebuilds the message cache                                                            | Added to the reasoning button's tooltip while warm                                                                                                                  | informs                                               | Documented              | Built                                                                                                       |
| 5   | The cache keeps missing                                                                                  | After 3 misses: "The prompt cache missed 3 times in this session. The last request read 0 of 112k tokens." Names the model, tools or system prompt when one changed | Dismiss                                               | Measured                | Built                                                                                                       |
| 6   | A big conversation costs a lot per message                                                               | Context meter appears at 200k tokens, not 60% of the window; tooltip gives the cost of one more message warm and cold                                               | Compact, New session                                  | Measured                | Built                                                                                                       |
| 7   | Haiku 5.5 charges 5x above 100k tokens                                                                   | Meter appears at 80k; tooltip gives the multiplier and the size                                                                                                     | Compact, New session                                  | Documented              | Built                                                                                                       |
| 8   | Claude 5 and 5.5 had no prices                                                                           | Dollar amounts now shown for them                                                                                                                                   | none                                                  | Documented              | Built                                                                                                       |
| 9   | A saved session is opened after a break                                                                  | The same cold-cache line as #1, using the size and time saved with the session: "Prompt cache expired 20 h ago. Sending re-reads 366k tokens..."                    | Compact first, New session, Use 1 hour cache          | Documented, measured    | Built (new sessions only; older saved sessions have no record)                                              |
| 10  | A very large message is about to be sent                                                                 | Line above the input while the draft is over about 30k tokens: its size, what writing it to the cache costs and what each later message costs to re-read            | Dismiss; edit the draft or start a new session        | Guess for the threshold | Built (counts typed and pasted text, code blocks and images; files added with @ are not counted until sent) |
| 11  | Attaching an image, turning a tool or an MCP server on or off, or reloading a server, rebuilds the cache | A sentence added to the tooltip of the image button, the tool policy and group switches, and the MCP Disconnect and Reload items while the cache is warm            | informs                                               | Documented              | Built                                                                                                       |
| 12  | A long context answers less reliably                                                                     | One line in the context meter tooltip from 200k tokens                                                                                                              | Compact, New session                                  | Documented              | Built                                                                                                       |
| 13  | A Regional Bedrock profile costs 10% more than the global one                                            | The setup form says so, and the choice is labelled "Global (10% cheaper)"                                                                                           | informs                                               | Documented              | Built                                                                                                       |

## Built

- `core/llm/utils/calculateRequestCost.ts`: Opus 5, Opus 5.5, Sonnet 5, Sonnet 5.5 and Haiku 5.5; cache reads at 0.05x on the two 5.5 models; Haiku 5.5's long-prompt tier. A later minor version (`claude-sonnet-5-6`) no longer matches an earlier entry's price and stays unpriced until added.
- `gui/src/util/cacheSafeguards.ts`: the rules and thresholds (`coldResume`, `warmCacheLoss`, `detectCacheMiss`, `promptCacheKey`, `LARGE_MESSAGE_TOKENS`). `cacheNotices.ts`: wording helpers.
- Components: `ColdCacheNotice`, `CacheMissNotice`, `LargeMessageNotice`, `NoticeBar`, `ModelSwitchConfirm`, `ModeSwitchCacheNotice`, and changes to `ModelSelect`, `ContextStatus`, `InputToolbar`, the tool policy and MCP server controls, and the Bedrock setup text. `useWarmCacheNote` gives them one shared sentence.
- A new session starts with an empty cache record. A loaded session brings back its own, so a resume after a break can say its cache expired.
- `Session` in `core/index.d.ts` has an optional `promptCache` (when the last request started, its size and lifetime), written by `saveCurrentSession` and kept by `HistoryManager.save`. Sessions saved before this have none and show no resume notice.

## Not built

Also on [`ROADMAP.md`](./ROADMAP.md) under Track C.

- **Caching on by default for Claude** (C4). A billing default; the owner decides.
- **Rules that change the system prompt mid-session** (C8). Rules matched against the latest tool output are written into the system prompt, so a match rebuilds the whole cache. Anthropic's mid-conversation system messages let an instruction be appended instead, which keeps the cache. The documentation (read 2026-11-04) sets these conditions, so the list of four models in the first draft of this plan was incomplete:
  - **Models.** Available on Fable 5.1 and 5, Mythos 5.1 and 5, Opus 5.5, Opus 5, Opus 4.8, Sonnet 5.5 and Haiku 5.5. **Not** on Sonnet 5, Sonnet 4.6 and 4.5, Opus 4.7, 4.6 and 4.5, or Haiku 4.5. No beta header is needed for the text form. Amazon Bedrock is listed as supported.
  - **Placement.** A system message that carries content cannot be the first entry. It must directly follow a user turn (including one that carries `tool_result` blocks) and come before an assistant turn or end the array. It cannot sit between a `tool_use` and its `tool_result`. Anywhere else is a 400 error.
  - **Trust.** Claude treats system content as operator instructions, so raw tool output or retrieved text must not go in one. Sonnet 5.5 and Haiku 5.5 "can treat a system message placed right after a tool result as untrusted text and ignore it", so on those two the user's words go in the user turn, as a text block after the last `tool_result`, and harness notices go in a separate system message after that user message.
  - **Tools.** Changing the `tools` array rebuilds the whole cache. Offering or withdrawing a tool by reference (`tool_addition` and `tool_removal` in a system message, beta header `mid-conversation-tool-changes-2026-07-01`) keeps it and is listed for Bedrock; defining a tool inline (`inline-tools-2026-09-15`) is not listed for Bedrock.
  - **Not verified for Converse.** The page shows the Messages API shape and never mentions Converse. The Bedrock SDK's `ConversationRole` enum includes `system`, which suggests the field exists, but no request with a `system` role in `messages` has been sent. That needs a live test before any code, and the result decides whether Bedrock users get this at all.
  - Our rules are matched against the latest tool output, which is exactly the "untrusted content" the page warns about. A rule's text comes from the user's own rule files, not from the tool output, so it is operator content; the matching is what depends on the output. That distinction has to hold in the code.

  This changes how requests are built for each provider, so it needs live testing on each. The miss notice already names "the system prompt" when this happens.

- **Resume notice for sessions saved before this change.** They have no record. An estimate from the stored messages would be rough.
- **Vertex and OpenRouter prices for Claude 5.x**, and the same Regional premium on Google Cloud.
- **Tool result clearing.** Context editing drops old tool results server-side, but each clearing rebuilds the cache, so it needs a minimum amount per clearing. Evaluate before offering.
- **Counting @-attached files in the large-message notice.** They are fetched when the message is sent.
- **Session cost in the toolbar** and a "spent on cold rewrites" line in the usage panel.
- **Guesses worth testing first**: suggest a new session after two rejected edits in a row; suggest a smaller model for a short, simple prompt.

## Limits

- Not clicked through in a real editor. Tests cover logic and rendering in jsdom.
- Changing model, tools or the system prompt makes the next requests count as misses. The notice names the cause, but if it proves noisy, count only misses with no known cause.
- The Anthropic-path breakpoints on tool results are tested with mocks only. The Bedrock path had one live run.
- Prices are list prices. A Regional Bedrock profile bills 10% more, so Bedrock figures for those models read about 10% low.
- The 30k-token threshold for large messages, and the 4-characters-per-token estimate behind it, are guesses.
