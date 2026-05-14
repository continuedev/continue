/**
 * cliLlmAdapter.ts — Phase 4: Minimal ILLM adapter for the CLI.
 *
 * Wraps a BaseLlmApi + ModelConfig in just enough of the ILLM interface to
 * drive core's AgentRunner loop (streamChat + contextLength + countTokens).
 * All other ILLM methods throw — they are not called by AgentRunner.
 */

import type { ModelConfig } from "@yutoagentic/config-yaml";
import type { BaseLlmApi } from "@yutoagentic/openai-adapters";
import type { ChatMessage, Tool } from "core/index.js";
import { convertFromUnifiedMessage } from "core/util/messageConversion.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions.mjs";

function coreToolToOpenAI(tool: Tool): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters ?? {},
    },
  };
}

/**
 * Minimal ILLM-compatible adapter wrapping a BaseLlmApi + ModelConfig.
 *
 * Cast to `ILLM` at usage site with `as unknown as ILLM` — only the methods
 * actually called by AgentRunner are implemented.
 */
export class BaseLlmApiAdapter {
  // ── Required fields expected by AgentRunner / ILLM ────────────────────────
  readonly model: string;
  readonly contextLength: number;
  // Fields required by ILLM (from LLMOptions RequiredLLMOptions)
  readonly uniqueId: string;
  readonly embeddingId: string = "";
  readonly maxEmbeddingChunkSize: number = 0;
  readonly maxEmbeddingBatchSize: number = 0;
  readonly completionOptions: any = {};

  constructor(
    private readonly llmApi: BaseLlmApi,
    private readonly modelConfig: ModelConfig,
  ) {
    this.model = modelConfig.model;
    this.contextLength = modelConfig.contextLength ?? 128_000;
    this.uniqueId = `cli-adapter-${modelConfig.model}`;
  }

  get providerName(): string {
    return this.modelConfig.provider;
  }

  get underlyingProviderName(): string {
    return this.modelConfig.provider;
  }

  /** Rough token estimate: ~4 chars per token. */
  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Stream a chat completion.
   *
   * Converts Continue ChatMessage[] → OpenAI params, calls chatCompletionStream,
   * and yields Continue ChatMessage deltas.  Tool call ids are tracked by index
   * so every delta carries the same id — this makes AgentRunner's accumulation
   * logic work correctly even though OpenAI only sends the id on the first chunk.
   */
  async *streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options?: { tools?: Tool[] },
  ): AsyncGenerator<ChatMessage, any> {
    const openaiMessages = messages
      .filter((m) => m.role !== "thinking")
      .map(convertFromUnifiedMessage);

    const openaiTools: ChatCompletionTool[] =
      options?.tools?.map(coreToolToOpenAI) ?? [];

    const body: any = {
      model: this.modelConfig.model,
      messages: openaiMessages,
      stream: true,
      ...(openaiTools.length > 0 ? { tools: openaiTools } : {}),
      ...(this.modelConfig.defaultCompletionOptions?.maxTokens
        ? { max_tokens: this.modelConfig.defaultCompletionOptions.maxTokens }
        : {}),
    };

    const stream = this.llmApi.chatCompletionStream(body, signal);

    // Track tool-call ids by their OpenAI streaming index.
    // AgentRunner accumulates by id so we include it on every delta.
    const idByIndex = new Map<number, string>();

    for await (const chunk of stream) {
      if (signal.aborted) break;

      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { role: "assistant", content: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (tc.id) idByIndex.set(idx, tc.id);
          const id = idByIndex.get(idx) ?? `tc_${idx}`;

          if (
            tc.function?.name !== undefined ||
            tc.function?.arguments !== undefined
          ) {
            yield {
              role: "assistant",
              content: "",
              toolCalls: [
                {
                  id,
                  type: "function" as const,
                  function: {
                    name: tc.function?.name,
                    arguments: tc.function?.arguments,
                  },
                },
              ],
            } as ChatMessage;
          }
        }
      }
    }
  }

  // ── Stub methods — not called by AgentRunner ──────────────────────────────

  async complete(): Promise<string> {
    throw new Error("BaseLlmApiAdapter.complete: not implemented");
  }

  streamComplete(): any {
    throw new Error("BaseLlmApiAdapter.streamComplete: not implemented");
  }

  streamFim(): any {
    throw new Error("BaseLlmApiAdapter.streamFim: not implemented");
  }

  async chat(): Promise<ChatMessage> {
    throw new Error("BaseLlmApiAdapter.chat: not implemented");
  }

  compileChatMessages(): any {
    throw new Error("BaseLlmApiAdapter.compileChatMessages: not implemented");
  }

  async embed(): Promise<number[][]> {
    throw new Error("BaseLlmApiAdapter.embed: not implemented");
  }

  async rerank(): Promise<number[]> {
    throw new Error("BaseLlmApiAdapter.rerank: not implemented");
  }

  supportsImages(): boolean {
    return false;
  }

  supportsCompletions(): boolean {
    return false;
  }

  supportsPrefill(): boolean {
    return false;
  }

  supportsFim(): boolean {
    return false;
  }

  async listModels(): Promise<string[]> {
    return [];
  }

  renderPromptTemplate(): any {
    throw new Error("BaseLlmApiAdapter.renderPromptTemplate: not implemented");
  }

  getConfigurationStatus(): any {
    return "ok";
  }
}
