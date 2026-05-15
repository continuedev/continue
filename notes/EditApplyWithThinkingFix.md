# Fix: Thinking Content in Edit and Apply

## New function

`renderChatMessageWithoutThinking()` added to `core/util/messageContent.ts`:

```ts
export function renderChatMessageWithoutThinking(message: ChatMessage): string {
  if (message.role === "thinking") return "";
  return renderChatMessage(message);
}
```

## Fix coverage — three categories

### Category 1 — Streaming chat, line-oriented output

Callers use `llm.streamChat()` directly; output flows through `streamLines()` in `core/diff/util.ts`. Fixed once at `streamLines()`, covering all three Edit/Apply paths: `streamDiffLines` (main edit), `streamLazyApply` (large-file apply), and `lazy/replace` (fills in unchanged-code placeholders within lazy apply).

### Category 2 — Streaming complete, provider uses Chat API internally

Callers use `llm.streamComplete()`. The concrete providers' `_streamComplete()` implementations call the Chat API under the hood (most modern APIs are chat-only) and convert `ChatMessage` chunks to strings themselves. Fixed at each provider's `_streamComplete()` conversion point.

### Category 3 — Non-streaming chat

Callers use `llm.chat()`, which is just `streamChat()` buffered into a single `{ role: "assistant", content: string }` message. Fixed once at `BaseLLM.chat()` in `core/llm/index.ts`, covering all five utility callers: title generation, repo map summarisation, tool selection, next-edit prediction, and conversation compaction.

---

## Call site changes

| File                          | Method              | Path fixed                                                        |
| ----------------------------- | ------------------- | ----------------------------------------------------------------- |
| `core/diff/util.ts`           | `streamLines()`     | Apply + Edit with rules (Chat path)                               |
| `core/llm/llms/OpenAI.ts`     | `_streamComplete()` | Edit without rules (Complete path), OpenAI-compatible providers   |
| `core/llm/llms/Anthropic.ts`  | `_streamComplete()` | Edit without rules (Complete path), Anthropic                     |
| `core/llm/llms/Bedrock.ts`    | `_streamComplete()` | Edit without rules (Complete path), AWS Bedrock                   |
| `core/llm/llms/Gemini.ts`     | `_streamComplete()` | Edit without rules (Complete path), Gemini                        |
| `core/llm/llms/VertexAI.ts`   | `_streamComplete()` | Edit without rules (Complete path), Vertex AI                     |
| `core/llm/llms/Cohere.ts`     | `_streamComplete()` | Edit without rules (Complete path), Cohere                        |
| `core/llm/llms/Cloudflare.ts` | `_streamComplete()` | Edit without rules (Complete path), Cloudflare Workers AI         |
| `core/llm/llms/Flowise.ts`    | `_streamComplete()` | Edit without rules (Complete path), Flowise                       |
| `core/llm/llms/CustomLLM.ts`  | `_streamComplete()` | Edit without rules (Complete path), custom LLMs                   |
| `core/llm/index.ts`           | `BaseLLM.chat()`    | Title generation (`chatDescriber.ts`)                             |
| `core/llm/index.ts`           | `BaseLLM.chat()`    | Repo map summarisation (`repoMapRequest.ts`)                      |
| `core/llm/index.ts`           | `BaseLLM.chat()`    | Tool selection for context retrieval (`BaseRetrievalPipeline.ts`) |
| `core/llm/index.ts`           | `BaseLLM.chat()`    | Next-edit prediction (`NextEditProvider.ts`)                      |
| `core/llm/index.ts`           | `BaseLLM.chat()`    | Conversation compaction (`conversationCompaction.ts`)             |

## Call site intentionally NOT replaced

### `core/edit/recursiveStream.ts` — `renderChatMessage` kept

`recursiveStream` accumulates all streamed chunks into an internal `buffer` variable. This buffer is intended as a faithful reproduction of everything the model generated, for use by the recursive continuation logic (currently commented out): when the model hits its token limit mid-edit, the plan is to re-prompt with the buffer as context and continue from exactly where it left off. Stripping thinking content from the buffer would corrupt that continuation context.

Thinking content is already filtered downstream: `streamLines()` in `core/diff/util.ts` — which consumes the yielded chunks from `recursiveStream` — uses `renderChatMessageWithoutThinking`, so nothing reaches the diff pipeline or the UI.
| `core/util/historyUtils.ts` | `toMarkDown()` | Conversation history export to Markdown |
| `core/commands/slash/built-in-legacy/review.ts` | `run()` | Legacy `/review` slash command |
| `core/commands/slash/built-in-legacy/commit.ts` | `run()` | Legacy `/commit` slash command |
| `core/commands/slash/built-in-legacy/draftIssue.ts` | `run()` | Legacy `/draftIssue` slash command |
| `core/commands/slash/built-in-legacy/onboard.ts` | `run()` | Legacy `/onboard` slash command |
