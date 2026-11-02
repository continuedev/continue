# Patch 01: NIM/vLLM Empty Response Retry

## Summary

OpenAI-compatible servers (NIM, vLLM) return `content: null` with empty `tool_calls: []` when tools are provided in request but the model decides not to call any tool. This results in blank responses in Continue GUI.

**Fix**: Detect empty response → retry the same request without `tools` parameter → model returns text content normally.

---

## Affected File

```
packages/openai-adapters/src/apis/OpenAI.ts
```

**Class**: `OpenAIApi`
**Method**: `chatCompletionNonStream()`

---

## Root Cause

### Server Behavior (NIM Nemotron Ultra 253B)

Request WITH tools + casual message (e.g., "Hello"):
```json
{
  "choices": [{
    "message": {
      "content": null,
      "tool_calls": []
    }
  }]
}
```

Same request WITHOUT tools:
```json
{
  "choices": [{
    "message": {
      "content": "Hello! How can I help you?",
      "tool_calls": []
    }
  }]
}
```

### Continue Behavior (before fix)

`fromChatResponse()` receives `content: null` → produces `{ role: "assistant", content: "" }` → GUI renders blank.

---

## Code Change

```typescript
// File: packages/openai-adapters/src/apis/OpenAI.ts
// Method: chatCompletionNonStream()

async chatCompletionNonStream(
  body: ChatCompletionCreateParamsNonStreaming,
  signal: AbortSignal,
): Promise<ChatCompletion> {
  if (this.shouldUseResponsesEndpoint(body.model)) {
    const response = await this.responsesNonStream(body, signal);
    return responseToChatCompletion(response);
  }

  // Changed: const → let (to allow reassignment on retry)
  let response = await this.openai.chat.completions.create(
    this.modifyChatBody(body),
    { signal },
  );

  // === PATCH START ===
  // Some OpenAI-compatible servers (e.g. NIM, vLLM) return content: null
  // with an empty tool_calls array when tools are provided but the model
  // decides not to call any. This is effectively an empty response that
  // the GUI renders as blank. Retry without tools so the model responds
  // with text content instead.
  const msg = response.choices?.[0]?.message;
  if (
    msg &&
    !msg.content &&
    (!msg.tool_calls || msg.tool_calls.length === 0) &&
    body.tools?.length
  ) {
    const { tools, tool_choice, ...bodyWithoutTools } = body;
    response = await this.openai.chat.completions.create(
      this.modifyChatBody(
        bodyWithoutTools as ChatCompletionCreateParamsNonStreaming,
      ),
      { signal },
    );
  }
  // === PATCH END ===

  return response;
}
```

---

## Behavior Matrix

| Model Response | tools in request | Retry? | Result |
|---|---|---|---|
| `content: "Hello"`, `tool_calls: []` | Yes | ❌ No | Text shown normally |
| `content: null`, `tool_calls: [{...}]` | Yes | ❌ No | Tool call executed |
| `content: null`, `tool_calls: []` | Yes | ✅ Yes | Retry → text shown |
| `content: null`, `tool_calls: []` | No | ❌ No | Empty (no tools to remove) |
| `content: "Hi"`, `tool_calls: [{...}]` | Yes | ❌ No | Both shown |

---

## Trade-offs

- **Latency**: Adds one extra API call when empty response is detected (~2-5s for NIM)
- **Correctness**: Model genuinely wants to say nothing → forced to respond (acceptable for coding assistant)
- **Scope**: Only affects `chatCompletionNonStream` (non-streaming path). Streaming path typically doesn't hit this issue because streaming response parser handles partial content differently.

---

## Affected Models

| Model | Server | Triggers Empty Response |
|-------|--------|:----------------------:|
| nvidia/nemotron-ultra-253b | NIM | ✅ Frequently |
| deepseek-ai/DeepSeek-V4-Flash | vLLM | ✅ Occasionally |
| zai-org/GLM-5.2-FP8 | vLLM | ✅ Occasionally |
| moonshotai/Kimi-K2.6 | vLLM | ❌ Rarely (has reasoning) |

---

## Verification

```bash
# 1. Confirm patch present
grep -n "Retry without tools" packages/openai-adapters/src/apis/OpenAI.ts

# 2. Test in Continue
# - Select NIM model in Agent mode
# - Send "Hello" or "Chào bạn"
# - Should see text response (not blank)
```

---

## Upstream Status

- Related: [continuedev/continue#5508](https://github.com/continuedev/continue/issues/5508)
- Related PR: [#12591](https://github.com/continuedev/continue/pull/12591)
- **Not merged upstream** — this is our custom patch
- Consider submitting PR to `continuedev/continue` when stable

