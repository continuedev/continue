# Patch 02: Tool Arguments JSON Sanitize

## Summary

When LLMs (particularly Kimi K2.6) generate malformed JSON in `tool_calls.function.arguments`, Continue stores this in conversation history and sends it back to the server on subsequent turns. vLLM rejects the request with `400 Expecting ',' delimiter` because it validates JSON in tool_calls arguments during preprocessing.

**Fix**: Validate JSON before sending tool_calls arguments back to server. If invalid, wrap in a valid JSON envelope.

---

## Affected File

```
core/llm/openaiTypeConverters.ts
```

**Function**: `toChatMessage()`
**Location**: "Add tool calls if present" section (~line 157)

---

## Root Cause

### Flow

```
Turn N:   Model generates tool_call with malformed arguments
          e.g., {"path": "/tmp/x" "content": "hello"}  ← missing comma
Turn N+1: Continue sends full conversation history back to server
          History includes the malformed arguments verbatim
Turn N+1: vLLM validates JSON in request body → JSONDecodeError → 400
```

### Why models generate malformed JSON

1. **Truncation**: `max_tokens` limit cuts off mid-JSON
2. **Reasoning token leak**: Without `--reasoning-parser`, thinking tokens leak into arguments
3. **Model hallucination**: LLM occasionally generates syntactically invalid JSON
4. **Encoding issues**: Special characters (newlines, quotes) not properly escaped

### vLLM GitHub Issue

[vllm-project/vllm#43995](https://github.com/vllm-project/vllm/issues/43995):
> "When a conversation contains a tool call whose arguments field is not valid JSON, vLLM's HF tokenizer tool parser crashes during request preprocessing with a JSONDecodeError."

---

## Code Change

```typescript
// File: core/llm/openaiTypeConverters.ts
// Function: toChatMessage()

// Add tool calls if present
if (message.toolCalls) {
  msg.tool_calls = message.toolCalls.map((toolCall) => {
    // === PATCH START ===
    // Sanitize arguments — ensure valid JSON to prevent vLLM 400 errors
    // when malformed tool arguments from previous turns are sent back in history
    let args = toolCall.function?.arguments || "{}";
    try {
      JSON.parse(args);
    } catch {
      // If arguments are not valid JSON, wrap them to prevent server rejection
      args = JSON.stringify({ _raw: args });
    }
    // === PATCH END ===
    return {
      id: toolCall.id!,
      type: toolCall.type!,
      function: {
        name: toolCall.function?.name!,
        arguments: args,
      },
    };
  });
}
```

### Before (vulnerable)

```typescript
msg.tool_calls = message.toolCalls.map((toolCall) => ({
  id: toolCall.id!,
  type: toolCall.type!,
  function: {
    name: toolCall.function?.name!,
    arguments: toolCall.function?.arguments || "{}",  // pass-through, no validation
  },
}));
```

---

## Behavior

| Input arguments | Valid JSON? | Output |
|---|---|---|
| `{"path": "/tmp/x"}` | ✅ | Pass-through unchanged |
| `{"path": "/tmp/x" "content": "hi"}` | ❌ | `{"_raw": "{\"path\": \"/tmp/x\" \"content\": \"hi\"}"}` |
| `""` (empty) | — | `"{}"` (fallback) |
| `null` / `undefined` | — | `"{}"` (fallback) |
| `{"cmd": "ls"}` (valid) | ✅ | Pass-through unchanged |

---

## Trade-offs

- **Performance**: `JSON.parse()` on every tool_call argument in history — negligible cost (microseconds per call)
- **Semantics**: Wrapped `{"_raw": "..."}` may confuse model on next turn, but:
  - Model primarily reads tool results (`role: tool`), not its own previous arguments
  - This is strictly better than conversation crashing with 400
  - Edge case: only triggers when model already made an error
- **No data loss**: Original malformed string preserved in `_raw` field

---

## Affected Models

| Model | Frequency of malformed args |
|-------|:---------------------------:|
| moonshotai/Kimi-K2.6 | Medium (especially without `--reasoning-parser`) |
| deepseek-ai/DeepSeek-V4-Flash | Low |
| nvidia/nemotron-ultra-253b | Low |
| Any model with insufficient max_tokens | High (truncation) |

---

## Server-side Complement

This client patch works TOGETHER with server-side fix:

```bash
# For Kimi K2.6 — MUST include both parsers
vllm serve moonshotai/Kimi-K2.6 \
  --tool-call-parser kimi_k2 \
  --reasoning-parser kimi_k2 \    # ← prevents thinking token leak
  --trust-remote-code
```

- Server fix reduces occurrence by ~90%
- Client patch catches remaining ~10% edge cases

---

## Verification

```bash
# 1. Confirm patch present
grep -n "Sanitize arguments" core/llm/openaiTypeConverters.ts

# 2. Test in Continue
# - Select Kimi K2.6 in Agent mode
# - Trigger multiple tool calls in conversation
# - Even if model generates bad arguments, conversation should NOT crash
# - "Resubmit" button should work without 400 errors
```

---

## Upstream Status

- Related: [vllm-project/vllm#43995](https://github.com/vllm-project/vllm/issues/43995)
- **Not merged upstream** — this is our custom patch
- Could benefit all users of OpenAI-compatible servers
- Consider submitting PR to `continuedev/continue`

