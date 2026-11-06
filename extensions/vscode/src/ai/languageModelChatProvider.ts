import type {
  AssistantChatMessage,
  ChatMessage,
  ILLM,
  Tool,
  ToolCallDelta,
} from "core";
import { countTokens } from "core/llm/countTokens";
import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { renderChatMessage } from "core/util/messageContent";
import * as vscode from "vscode";

/** Must match contributes.languageModelChatProviders[].vendor in package.json. */
export const LM_VENDOR = "continued";

const DEFAULT_CONTEXT_LENGTH = 32_768;
const DEFAULT_MAX_TOKENS = 4_096;

interface ContinuedModelInfo extends vscode.LanguageModelChatInformation {
  /** The title of the Continued model this entry stands for. */
  readonly llmTitle: string;
}

/**
 * Offers the chat models of the selected Continued config to VS Code's chat
 * and agents. Requests run through Continued's own LLM classes, so they use
 * the keys and settings from the config and providers.yaml; keys never pass
 * to VS Code.
 */
export class ContinuedLanguageModelChatProvider implements vscode.LanguageModelChatProvider<ContinuedModelInfo> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeLanguageModelChatInformation = this.changed.event;

  private models: ILLM[] = [];
  private enabled = true;

  /** Called when the config reloads. */
  update(chatModels: ILLM[] | undefined) {
    const next = chatModels ?? [];
    const key = (list: ILLM[]) =>
      list.map((m) => `${m.title}|${m.providerName}|${m.model}`).join(",");
    if (key(next) === key(this.models)) {
      this.models = next; // same models, fresh instances
      return;
    }
    this.models = next;
    this.changed.fire();
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.changed.fire();
  }

  provideLanguageModelChatInformation(): ContinuedModelInfo[] {
    if (!this.enabled) return [];
    const seen = new Set<string>();
    return this.models.flatMap((llm) => {
      const title = llm.title ?? llm.model;
      if (seen.has(title)) return [];
      seen.add(title);
      return [modelInfo(llm, title)];
    });
  }

  async provideLanguageModelChatResponse(
    model: ContinuedModelInfo,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const llm = this.findModel(model);
    const abort = new AbortController();
    const sub = token.onCancellationRequested(() => abort.abort());
    try {
      const tools = options.tools?.length
        ? options.tools.map(toContinuedTool)
        : undefined;
      const toolCalls = new ToolCallCollector();
      for await (const chunk of llm.streamChat(
        toChatMessages(messages),
        abort.signal,
        {
          ...(tools ? { tools } : {}),
          // Continued can force one named tool, not "any tool": honour
          // Required mode when exactly one tool is offered.
          ...(tools?.length === 1 &&
          options.toolMode === vscode.LanguageModelChatToolMode.Required
            ? {
                toolChoice: {
                  type: "function" as const,
                  function: { name: tools[0].function.name },
                },
              }
            : {}),
        },
      )) {
        if (token.isCancellationRequested) break;
        if (chunk.role !== "assistant") continue; // thinking and others
        const text = renderChatMessage(chunk);
        if (text) progress.report(new vscode.LanguageModelTextPart(text));
        for (const delta of (chunk as AssistantChatMessage).toolCalls ?? []) {
          toolCalls.add(delta);
        }
      }
      for (const call of toolCalls.finish()) {
        progress.report(
          new vscode.LanguageModelToolCallPart(call.id, call.name, call.input),
        );
      }
    } finally {
      sub.dispose();
    }
  }

  async provideTokenCount(
    model: ContinuedModelInfo,
    text: string | vscode.LanguageModelChatRequestMessage,
  ): Promise<number> {
    const llm = this.models.find(
      (m) => (m.title ?? m.model) === model.llmTitle,
    );
    const content =
      typeof text === "string"
        ? text
        : toChatMessages([text])
            .map((m) => renderChatMessage(m))
            .join("\n");
    return countTokens(content, llm?.model ?? model.version);
  }

  private findModel(model: ContinuedModelInfo): ILLM {
    const llm = this.models.find(
      (m) => (m.title ?? m.model) === model.llmTitle,
    );
    if (!llm) {
      throw new Error(
        `${model.name} is no longer in the selected Continued config.`,
      );
    }
    return llm;
  }

  dispose() {
    this.changed.dispose();
  }
}

export function modelInfo(llm: ILLM, title: string): ContinuedModelInfo {
  const maxOutputTokens =
    llm.completionOptions?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const contextLength = llm.contextLength ?? DEFAULT_CONTEXT_LENGTH;
  const toolCalling = modelSupportsNativeTools({
    title,
    provider: llm.underlyingProviderName ?? llm.providerName,
    model: llm.model,
    capabilities: llm.capabilities,
  } as any);
  return {
    id: title,
    llmTitle: title,
    name: title,
    family: llm.providerName,
    version: llm.model,
    detail: "Continued",
    tooltip: `${llm.providerName} · ${llm.model} (from your Continued config)`,
    maxInputTokens: Math.max(1, contextLength - maxOutputTokens),
    maxOutputTokens,
    capabilities: { toolCalling: !!toolCalling, imageInput: false },
  };
}

/** VS Code request messages to Continued chat messages. */
export function toChatMessages(
  messages: readonly vscode.LanguageModelChatRequestMessage[],
): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const message of messages) {
    let text = "";
    const toolCalls: { id: string; name: string; input: object }[] = [];
    for (const part of message.content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        text += part.value;
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        toolCalls.push({ id: part.callId, name: part.name, input: part.input });
      } else if (part instanceof vscode.LanguageModelToolResultPart) {
        // Tool results become their own "tool" messages, in order.
        if (text) {
          out.push({ role: "user", content: text });
          text = "";
        }
        out.push({
          role: "tool",
          toolCallId: part.callId,
          content: part.content
            .map((c) =>
              c instanceof vscode.LanguageModelTextPart
                ? c.value
                : typeof c === "string"
                  ? c
                  : JSON.stringify(c),
            )
            .join(""),
        });
      }
    }
    if (message.role === vscode.LanguageModelChatMessageRole.Assistant) {
      out.push({
        role: "assistant",
        content: text,
        ...(toolCalls.length
          ? {
              toolCalls: toolCalls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: JSON.stringify(c.input) },
              })),
            }
          : {}),
      });
    } else if (text) {
      out.push({ role: "user", content: text });
    }
  }
  return out;
}

export function toContinuedTool(tool: vscode.LanguageModelChatTool): Tool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: (tool.inputSchema as Record<string, any>) ?? {
        type: "object",
        properties: {},
      },
    },
    displayTitle: tool.name,
    readonly: false,
    group: "VS Code",
  };
}

/**
 * Tool calls stream in as deltas: the first names the call, later ones add
 * argument text. Deltas without an id continue the previous call.
 */
export class ToolCallCollector {
  private calls: { id: string; name: string; args: string }[] = [];

  add(delta: ToolCallDelta) {
    const last = this.calls[this.calls.length - 1];
    if (delta.id && delta.id !== last?.id) {
      this.calls.push({
        id: delta.id,
        name: delta.function?.name ?? "",
        args: delta.function?.arguments ?? "",
      });
      return;
    }
    if (!last) {
      this.calls.push({
        id: `call_${this.calls.length}`,
        name: delta.function?.name ?? "",
        args: delta.function?.arguments ?? "",
      });
      return;
    }
    if (delta.function?.name && !last.name) last.name = delta.function.name;
    if (delta.function?.arguments) last.args += delta.function.arguments;
  }

  finish(): { id: string; name: string; input: object }[] {
    return this.calls
      .filter((c) => c.name)
      .map((c) => {
        let input: object = {};
        try {
          const parsed = c.args.trim() ? JSON.parse(c.args) : {};
          input = parsed && typeof parsed === "object" ? parsed : {};
        } catch {
          input = {};
        }
        return { id: c.id, name: c.name, input };
      });
  }
}
