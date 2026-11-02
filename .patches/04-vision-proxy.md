# Patch 04: Vision Proxy — Multi-Model Image Understanding

## Summary

Text-only LLMs (DeepSeek V4 Flash) cannot process images natively. This patch adds a **Vision Proxy** pipeline that automatically routes image messages through a Vision Language Model (VLM) for text description, then passes the combined text to the main LLM.

**Result**: DeepSeek V4 Flash (524K context) gains image understanding capability via Qwen2.5-VL-32B, with only +2-5s latency per image.

---

## Affected Files

| File                                         | Change                                       |
| -------------------------------------------- | -------------------------------------------- |
| `core/llm/visionProxy.ts`                    | **NEW** — Vision proxy module                |
| `core/llm/index.ts`                          | Import + inject into `streamChat()` pipeline |
| `core/index.d.ts`                            | Add `visionProxy` to `LLMOptions` interface  |
| `packages/config-yaml/src/schemas/models.ts` | Add `visionProxy` to model schema            |

---

## Architecture

```
User message (may contain images)
    │
    ▼
BaseLLM.streamChat()
    │
    ├─ compileChatMessages() — fit context window
    │
    ├─ ★ Vision Proxy (NEW) — if images detected:
    │       │
    │       ├─ Extract image parts
    │       ├─ Send each image → Qwen2.5-VL-32B (port 7002)
    │       ├─ Receive text descriptions
    │       └─ Replace image parts → [Image Description: ...]
    │
    ├─ toChatBody() — convert to OpenAI format
    │
    └─ Send to DeepSeek V4 Flash (port 7021, 524K context)
```

---

## Configuration

### config.yaml

```yaml
models:
  - name: DeepSeek V4 Flash XL (vLLM)
    provider: openai
    model: deepseek-ai/DeepSeek-V4-Flash
    apiBase: http://171.232.252.166:7021/v1
    apiKey: sk-dev-h200-MC0bjr1Kow
    roles: [chat, edit, apply]
    defaultCompletionOptions:
      contextLength: 524288
      maxTokens: 16384
      temperature: 0.3
    capabilities:
      - tool_use
    visionProxy:
      endpoint: http://171.232.252.166:7002/v1
      model: Qwen/Qwen2.5-VL-32B-Instruct
      apiKey: sk-dev-h200-MC0bjr1Kow
      maxTokens: 2048
      promptTemplate: auto # code | ui | diagram | auto | custom string
      temperature: 0.2
      timeout: 30000
      enabled: true
```

### VisionProxy Options

| Field            | Type    | Default | Description                 |
| ---------------- | ------- | ------- | --------------------------- |
| `endpoint`       | string  | —       | VLM API endpoint (required) |
| `model`          | string  | —       | VLM model name (required)   |
| `apiKey`         | string  | —       | API key for VLM             |
| `maxTokens`      | number  | 2048    | Max tokens for description  |
| `promptTemplate` | string  | "auto"  | Prompt template for VLM     |
| `temperature`    | number  | 0.2     | VLM temperature             |
| `timeout`        | number  | 30000   | Request timeout (ms)        |
| `enabled`        | boolean | true    | Enable/disable proxy        |

### Prompt Templates

| Template      | Best for                                      |
| ------------- | --------------------------------------------- |
| `code`        | **OCR mode** — extracts ONLY code, ignores UI |
| `config`      | **OCR mode** — extracts ONLY config (YAML/JSON) |
| `error`       | **OCR mode** — extracts ONLY error messages   |
| `ui`          | UI/UX screenshots, web pages                  |
| `diagram`     | Architecture diagrams, flowcharts              |
| `auto`        | General-purpose — prioritizes code (default)  |
| Custom string | Your own prompt                               |

**OCR templates** (`code`, `config`, `error`) are strict — they output ONLY the content, no descriptions, no markdown formatting. Use these when you want the main LLM to see exactly what's on screen without VLM commentary.

---

## Behavior

| Scenario                                    | Action                                              |
| ------------------------------------------- | --------------------------------------------------- |
| Message has images + visionProxy configured | Route through VLM → text                            |
| Message has images + no visionProxy         | Pass through (model must support images)            |
| Message text-only                           | Pass through unchanged (zero overhead)              |
| VLM returns error                           | Graceful fallback: `[Image: VLM error — ...]`       |
| VLM times out                               | Graceful fallback: `[Image: VLM request timed out]` |
| `enabled: false`                            | Skip proxy entirely                                 |

---

## Performance

| Operation         |  Latency   | Notes                         |
| ----------------- | :--------: | ----------------------------- |
| Text-only message |    +0ms    | No overhead, skipped entirely |
| 1 image → VLM     |   +2-5s    | Depends on image size         |
| Multiple images   | +2-5s each | Sequential processing         |
| VLM timeout       |  30s max   | Configurable                  |

---

## Verification

```bash
# 1. Confirm files exist
ls core/llm/visionProxy.ts

# 2. Confirm injection in pipeline
grep -n "Vision Proxy" core/llm/index.ts

# 3. Confirm schema
grep -n "visionProxy" packages/config-yaml/src/schemas/models.ts

# 4. Confirm type
grep -n "visionProxy" core/index.d.ts

# 5. Test in Continue
# - Add visionProxy config to config.yaml
# - Paste/upload an image in chat
# - Should see response that describes image content
# - Check console for [VisionProxy] logs
```

---

## Trade-offs

- **+** Enables image understanding for text-only LLMs (524K context preserved)
- **+** Zero overhead for text-only messages
- **+** Graceful degradation on VLM errors
- **+** Configurable per-model (some models can have proxy, others don't)
- **-** +2-5s latency per image
- **-** VLM description may lose visual nuance vs native multimodal
- **-** Sequential image processing (not parallel) — could optimize later

---

## Future Improvements

1. **Parallel image processing**: Process multiple images concurrently
2. ~~**Caching**: Cache VLM descriptions for repeated images (same base64)~~ ✅ **DONE** — 5-min TTL cache
3. **Streaming VLM**: Stream description for faster TTFT perception
4. **Smart routing**: Auto-detect image type → select best prompt template
5. **Fallback chain**: If primary VLM fails → try backup VLM → then fallback text

---

## Upstream Status

- **Custom patch** — not in upstream `continuedev/continue`
- Could benefit community if submitted as PR
- Would need feature flag/opt-in approach for upstream acceptance
