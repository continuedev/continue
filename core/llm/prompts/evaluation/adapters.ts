import type { ChatMessage, ILLM, Tool, ToolCallDelta } from "../../..";

/**
 * Minimal chat adapters with tool calling, for running the evaluation against
 * a real model without loading a Continue config. One non-streaming request
 * at temperature 0; the tools are sent in the provider's own shape and the
 * calls come back as `toolCalls` on the assistant message.
 */
type Chat = Pick<ILLM, "chat">;

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

function textOf(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p: any) => (p?.type === "text" ? String(p.text ?? "") : ""))
      .join("");
  }
  return "";
}

/** OpenAI, and anything that speaks its /chat/completions with tools (Ollama, LM Studio, vLLM, ...). */
export function openAiCompatible(opts: {
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Chat {
  return {
    chat: async (messages: ChatMessage[], signal, options) => {
      const body: any = {
        model: opts.model,
        messages: messages.map((m) => {
          if (m.role === "assistant") {
            const calls = (m.toolCalls ?? []).map((c) => ({
              id: c.id,
              type: "function",
              function: {
                name: c.function?.name,
                arguments: c.function?.arguments ?? "{}",
              },
            }));
            return {
              role: "assistant",
              content: textOf(m.content) || null,
              ...(calls.length ? { tool_calls: calls } : {}),
            };
          }
          if (m.role === "tool") {
            return {
              role: "tool",
              tool_call_id: m.toolCallId,
              content: m.content,
            };
          }
          return { role: m.role, content: textOf(m.content) };
        }),
        temperature: options?.temperature ?? 0,
        max_tokens: options?.maxTokens ?? 1500,
      };
      if (options?.tools?.length) {
        body.tools = options.tools.map((t: Tool) => ({
          type: "function",
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }));
      }
      const data = await postJson(
        `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`,
        opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {},
        body,
        signal,
      );
      const message = data.choices?.[0]?.message ?? {};
      const toolCalls: ToolCallDelta[] = (message.tool_calls ?? []).map(
        (c: any) => ({
          id: c.id,
          type: "function",
          function: {
            name: c.function?.name,
            arguments: c.function?.arguments ?? "{}",
          },
        }),
      );
      return {
        role: "assistant",
        content: message.content ?? "",
        ...(toolCalls.length ? { toolCalls } : {}),
      };
    },
  };
}

export function anthropicMessages(opts: {
  model: string;
  apiKey: string;
  baseUrl?: string;
}): Chat {
  return {
    chat: async (messages: ChatMessage[], signal, options) => {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => textOf(m.content))
        .join("\n");
      const converted: any[] = [];
      for (const m of messages) {
        if (m.role === "system") continue;
        if (m.role === "assistant") {
          const blocks: any[] = [];
          const text = textOf(m.content);
          if (text) blocks.push({ type: "text", text });
          for (const c of m.toolCalls ?? []) {
            let input: unknown = {};
            try {
              input = JSON.parse(c.function?.arguments || "{}");
            } catch {
              input = {};
            }
            blocks.push({
              type: "tool_use",
              id: c.id,
              name: c.function?.name,
              input,
            });
          }
          converted.push({ role: "assistant", content: blocks });
        } else if (m.role === "tool") {
          const block = {
            type: "tool_result",
            tool_use_id: m.toolCallId,
            content: m.content,
          };
          const last = converted[converted.length - 1];
          // Results of parallel calls share one user message.
          if (
            last?.role === "user" &&
            Array.isArray(last.content) &&
            last.content[0]?.type === "tool_result"
          ) {
            last.content.push(block);
          } else {
            converted.push({ role: "user", content: [block] });
          }
        } else if (m.role === "user") {
          converted.push({ role: "user", content: textOf(m.content) });
        }
      }
      const body: any = {
        model: opts.model,
        system,
        messages: converted,
        temperature: options?.temperature ?? 0,
        max_tokens: options?.maxTokens ?? 1500,
      };
      if (options?.tools?.length) {
        body.tools = options.tools.map((t: Tool) => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters ?? { type: "object" },
        }));
      }
      const data = await postJson(
        `${(opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`,
        { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
        body,
        signal,
      );
      const parts: any[] = data.content ?? [];
      const toolCalls: ToolCallDelta[] = parts
        .filter((p) => p.type === "tool_use")
        .map((p) => ({
          id: p.id,
          type: "function",
          function: { name: p.name, arguments: JSON.stringify(p.input ?? {}) },
        }));
      return {
        role: "assistant",
        content: parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join(""),
        ...(toolCalls.length ? { toolCalls } : {}),
      };
    },
  };
}
