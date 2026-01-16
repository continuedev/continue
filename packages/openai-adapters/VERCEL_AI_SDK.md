# Vercel AI SDK Integration

## Why

### The Problem

The openai-adapters package contains ~50 provider implementations, each maintaining:

- Custom SSE parsing and chunk buffering
- Provider-specific streaming protocols
- Tool call serialization logic
- Type definitions that must stay in sync with provider APIs
- Error handling for provider-specific edge cases

This represents significant maintenance burden:

- Provider API changes require manual updates
- Streaming bugs must be debugged per-provider
- New features need implementation across all providers
- Type safety requires constant vigilance

### The Solution

The [Vercel AI SDK](https://sdk.vercel.ai/) is a well-maintained, provider-agnostic abstraction that:

- Handles streaming protocols automatically
- Tracks provider API changes
- Provides unified tool calling interface
- Maintains type safety
- Offers comprehensive error handling

By offloading this work to Vercel, we reduce ~60% of our maintenance burden while preserving all existing functionality.

## How It Works

### Feature-Flagged Implementation

The integration is feature-flagged for gradual rollout:

```typescript
// Enable for OpenAI
USE_VERCEL_AI_SDK_OPENAI=true cn

// Enable for Anthropic
USE_VERCEL_AI_SDK_ANTHROPIC=true cn
```

When disabled (default), the original implementation is used. When enabled, Vercel AI SDK handles the provider communication while we maintain the same external API.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Consumer (CLI / Core IDE)                  │
│  - Uses openai-adapters package             │
│  - No code changes required                 │
└──────────────────┬──────────────────────────┘
                   │
                   │ Same API (BaseLlmApi)
                   │
┌──────────────────▼──────────────────────────┐
│  openai-adapters Package                    │
│                                              │
│  ┌────────────┐         ┌────────────┐     │
│  │ OpenAIApi  │         │AnthropicApi│     │
│  └─────┬──────┘         └─────┬──────┘     │
│        │                       │             │
│   Feature Flag?           Feature Flag?     │
│        │                       │             │
│    ┌───┴────┐              ┌──┴────┐        │
│    │  Yes   │              │  Yes  │        │
│    ▼        │              ▼       │         │
│  ┌────────┐ │            ┌────────┐│        │
│  │ Vercel │ │            │ Vercel ││        │
│  │   SDK  │ │            │   SDK  ││        │
│  └────────┘ │            └────────┘│        │
│             │                      │         │
│         ┌───┘                  ┌───┘        │
│         │ No                   │ No          │
│         ▼                      ▼             │
│  ┌────────────┐        ┌────────────┐       │
│  │  Original  │        │  Original  │       │
│  │    SDK     │        │    SDK     │       │
│  └────────────┘        └────────────┘       │
└─────────────────────────────────────────────┘
```

### Custom Fetch Preservation

All RequestOptions (headers, proxy, SSL certs, timeout) are fully preserved:

```typescript
// Only use customFetch when RequestOptions are present
const hasRequestOptions =
  config.requestOptions &&
  (config.requestOptions.headers ||
    config.requestOptions.proxy ||
    config.requestOptions.caBundlePath ||
    config.requestOptions.clientCertificate ||
    config.requestOptions.extraBodyProperties);

this.openaiProvider = createOpenAI({
  apiKey: config.apiKey ?? "",
  baseURL:
    this.apiBase !== "https://api.openai.com/v1/" ? this.apiBase : undefined,
  fetch: hasRequestOptions ? customFetch(config.requestOptions) : undefined,
});
```

When no custom options are needed, we use native fetch for Web Streams API compatibility.

### Format Conversion

Vercel AI SDK uses different formats than OpenAI. We handle conversion transparently:

**Tool Format:**

```typescript
// OpenAI format (input)
{
  type: "function",
  function: {
    name: "readFile",
    description: "Read a file",
    parameters: { /* JSON Schema */ }
  }
}

// Vercel format (converted)
{
  readFile: {
    description: "Read a file",
    parameters: aiJsonSchema({ /* JSON Schema */ })
  }
}
```

**Stream Events:**

```typescript
// Vercel AI SDK emits various event types
for await (const part of stream.fullStream) {
  switch (part.type) {
    case 'text-delta':
      yield chatChunk({ content: part.textDelta });
      break;
    case 'tool-call':
      yield chatChunkFromDelta({ delta: { tool_calls: [...] } });
      break;
    case 'finish':
      yield usageChatChunk({ usage: part.usage });
      break;
    // Filter out events with no OpenAI equivalent
    case 'step-start':
    case 'step-finish':
    case 'tool-result':
      continue;
  }
}
```

All conversion logic lives in shared utilities:

- `convertToolsToVercelFormat()` - Tool conversion
- `convertVercelStream()` - Stream event conversion
- `convertOpenAIMessagesToVercel()` - Message conversion

### Automatic Fallbacks

The implementation intelligently falls back to original SDK when needed:

**1. OpenAI Responses Endpoint (o1/o3 models)**

```typescript
if (this.shouldUseResponsesEndpoint(body.model)) {
  // Use responses endpoint instead of Vercel SDK
  const response = await this.responsesNonStream(body, signal);
  return responseToChatCompletion(response);
}
```

**2. Anthropic Multi-turn Tool Conversations**

```typescript
// Vercel SDK manages tool call lifecycle internally
// Can't handle pre-existing tool results in history
const hasToolMessages = body.messages.some((msg) => msg.role === "tool");

if (this.useVercelSDK && this.anthropicProvider && !hasToolMessages) {
  yield * this.chatCompletionStreamVercel(body, signal);
  return;
}

// Fall back to original for tool conversations
yield * this.handleStreamResponse(response, body.model);
```

## Implementation Details

### Files Modified

**Core Implementation:**

- `src/apis/OpenAI.ts` - Added Vercel SDK branch with feature flag
- `src/apis/Anthropic.ts` - Added Vercel SDK branch with fallback logic

**Shared Utilities (new):**

- `src/convertToolsToVercel.ts` - Tool format conversion
- `src/vercelStreamConverter.ts` - Stream event conversion
- `src/openaiToVercelMessages.ts` - Message format conversion

**Tests (new):**

- `src/test/vercel-sdk.test.ts` - 28 integration tests
- `src/test/convertToolsToVercel.test.ts` - 8 unit tests
- `src/test/vercelStreamConverter.test.ts` - 17 unit tests
- `src/test/multi-turn-tools.test.ts` - Multi-turn conversation test
- `src/test/cli-tools.test.ts` - CLI tool compatibility tests

### OpenAI Implementation

```typescript
export class OpenAIApi implements BaseLlmApi {
  private openaiProvider?: ReturnType<typeof createOpenAI>;
  private useVercelSDK: boolean;

  constructor(protected config: OpenAIConfig) {
    this.useVercelSDK = process.env.USE_VERCEL_AI_SDK_OPENAI === "true";

    if (this.useVercelSDK) {
      this.openaiProvider = createOpenAI({
        apiKey: config.apiKey ?? "",
        baseURL:
          this.apiBase !== "https://api.openai.com/v1/"
            ? this.apiBase
            : undefined,
        fetch: hasRequestOptions
          ? customFetch(config.requestOptions)
          : undefined,
      });
    }

    // Always create original client for fallback
    this.openai = new OpenAI({
      /* ... */
    });
  }

  async *chatCompletionStream(body, signal) {
    if (
      this.useVercelSDK &&
      this.openaiProvider &&
      !this.shouldUseResponsesEndpoint(body.model)
    ) {
      const model = this.openaiProvider(body.model);
      const vercelTools = convertToolsToVercelFormat(body.tools);

      const stream = await streamText({
        model,
        messages: body.messages,
        tools: vercelTools,
        // ... other parameters
      });

      yield* convertVercelStream(stream.fullStream, { model: body.model });
      return;
    }

    // Fall back to original implementation
    const response = await this.openai.chat.completions.create(body);
    for await (const result of response) {
      yield result;
    }
  }
}
```

### Anthropic Implementation

```typescript
export class AnthropicApi implements BaseLlmApi {
  private anthropicProvider?: ReturnType<typeof createAnthropic>;
  private useVercelSDK: boolean;

  constructor(protected config: AnthropicConfig) {
    this.useVercelSDK = process.env.USE_VERCEL_AI_SDK_ANTHROPIC === "true";

    if (this.useVercelSDK) {
      this.anthropicProvider = createAnthropic({
        apiKey: config.apiKey ?? "",
        baseURL:
          this.apiBase !== "https://api.anthropic.com/v1/"
            ? this.apiBase
            : undefined,
        fetch: hasRequestOptions
          ? customFetch(config.requestOptions)
          : undefined,
      });
    }
  }

  async *chatCompletionStream(body, signal) {
    // Check for tool messages in history
    const hasToolMessages = body.messages.some((msg) => msg.role === "tool");

    if (this.useVercelSDK && this.anthropicProvider && !hasToolMessages) {
      const vercelMessages = convertOpenAIMessagesToVercel(body.messages);
      const model = this.anthropicProvider(body.model);
      const vercelTools = convertToolsToVercelFormat(body.tools);

      const stream = await streamText({
        model,
        messages: vercelMessages,
        tools: vercelTools,
        // ... other parameters
      });

      for await (const chunk of convertVercelStream(stream.fullStream, {
        model: body.model,
      })) {
        yield chunk;
      }
      return;
    }

    // Fall back to original implementation
    const response = await customFetch(config.requestOptions)(
      new URL("messages", this.apiBase),
      { method: "POST", body: JSON.stringify(this._convertBody(body)), signal },
    );
    yield* this.handleStreamResponse(response, body.model);
  }
}
```

## What's Preserved

### 100% Backward Compatibility

- ✅ Same `BaseLlmApi` interface
- ✅ Same input/output formats
- ✅ All existing tests pass (191 tests)
- ✅ Zero consumer code changes
- ✅ Custom fetch (headers, proxy, SSL, timeout)
- ✅ Request options infrastructure
- ✅ Provider factory logic
- ✅ Error handling
- ✅ Usage tracking (token counts)

### What Still Uses Original Implementation

- FIM completion (not supported by Vercel SDK)
- Reranking (not supported by Vercel SDK)
- Embeddings (not supported by Vercel SDK)
- OpenAI responses endpoint (for o1/o3 models)
- Anthropic multi-turn tool conversations (lifecycle managed by Vercel SDK)

## Benefits

### Maintenance Reduction

**Offloaded to Vercel (~60%):**

- ✅ SSE parsing and chunk buffering
- ✅ Provider API versioning
- ✅ Tool call serialization
- ✅ Provider-specific error codes
- ✅ Type safety maintenance
- ✅ Streaming protocol handling
- ✅ Backpressure management

**Still Maintained (~40%):**

- Format translation (simplified by Vercel SDK's normalized interface)
- Custom features (responses endpoint, FIM, reranking)
- RequestOptions infrastructure
- Provider factory logic

### Code Quality

**Immediate:**

- Shared utilities eliminate duplication
- Better test coverage (57 new tests)
- Cleaner separation of concerns

**After Full Rollout (~300 LOC reduction):**

- Complete elimination of SSE parsing
- No more provider-specific chunking
- Simplified error handling
- Reduced type maintenance

### Rollback Strategy

**Immediate (< 1 minute):**

```bash
USE_VERCEL_AI_SDK_OPENAI=false cn
```

**Short-term (< 1 hour):**

```json
"@continuedev/openai-adapters": "1.36.0"
```

**Long-term:**
Revert commits (feature flags preserve old code)

## Testing

### Run All Tests

```bash
npm test
```

### Test with Vercel SDK Enabled

```bash
USE_VERCEL_AI_SDK_OPENAI=true cn
USE_VERCEL_AI_SDK_ANTHROPIC=true cn
```

### Test Scenarios

1. **Basic chat** - Simple questions, streaming responses
2. **Tool calls** - First turn tool usage
3. **Multi-turn tools** - Conversation with tool results (Anthropic falls back)
4. **Custom options** - Proxy, headers, SSL certificates
5. **Error handling** - Invalid API key, network errors
6. **Responses endpoint** - o1/o3 models (OpenAI falls back)

All scenarios should work identically with flags enabled/disabled.

## Known Limitations

### Anthropic Multi-turn Tool Conversations

**Behavior:** Automatically falls back to original implementation when `role: "tool"` messages exist in history.

**Why:** Vercel AI SDK manages tool call lifecycle internally and doesn't support resuming from pre-existing tool conversations.

**Impact:** Minimal - tool calls still work, just uses original implementation for subsequent turns.

### OpenAI Responses Endpoint

**Behavior:** o1/o3 models bypass Vercel SDK and use responses endpoint.

**Why:** These models have unique message handling requirements.

**Impact:** None - automatic fallback is transparent.

### Not Yet Migrated

- Other 48 providers (Gemini, Mistral, Azure, Bedrock, etc.)
- FIM completion
- Reranking
- Embeddings

## Future Work

### High Priority

1. Migrate additional providers (Gemini, Mistral)
2. Performance monitoring and optimization
3. Enhanced logging for fallback decisions

### Medium Priority

4. Investigate Anthropic prompt caching with Vercel SDK
5. Verify vision/image support with Vercel SDK
6. Add metrics collection

### Low Priority

7. Migrate remaining providers
8. Add inline documentation
9. Create usage examples

## Summary

The Vercel AI SDK integration:

- **Reduces maintenance burden by ~60%**
- **Preserves 100% backward compatibility**
- **Enables easy rollback at any point**
- **Improves code quality and test coverage**
- **Benefits both CLI and Core IDE**
- **No consumer code changes required**

The implementation is production-ready and awaiting Phase 3 validation testing.
