import type { ILLM } from "../../../..";

/**
 * Minimal chat adapters for running the evaluation against a real model
 * without loading a whole Continue config. They only do what the reviewer
 * needs: one non-streaming completion at temperature 0.
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

/** OpenAI, and anything that speaks its /chat/completions (Ollama, LM Studio, vLLM, ...). */
export function openAiCompatible(opts: {
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Chat {
  return {
    chat: async (messages: any[], signal, options) => {
      const data = await postJson(
        `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`,
        opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {},
        {
          model: opts.model,
          messages,
          temperature: options?.temperature ?? 0,
          max_tokens: options?.maxTokens ?? 300,
        },
        signal,
      );
      return {
        role: "assistant",
        content: data.choices?.[0]?.message?.content ?? "",
      } as any;
    },
  };
}

export function anthropicMessages(opts: {
  model: string;
  apiKey: string;
  baseUrl?: string;
}): Chat {
  return {
    chat: async (messages: any[], signal, options) => {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const data = await postJson(
        `${(opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`,
        { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
        {
          model: opts.model,
          system,
          messages: messages.filter((m) => m.role !== "system"),
          temperature: options?.temperature ?? 0,
          max_tokens: options?.maxTokens ?? 300,
        },
        signal,
      );
      const text = (data.content ?? [])
        .map((p: any) => (p.type === "text" ? p.text : ""))
        .join("");
      return { role: "assistant", content: text } as any;
    },
  };
}
