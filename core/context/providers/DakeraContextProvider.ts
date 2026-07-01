import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

/**
 * DakeraContextProvider retrieves semantically relevant memories from a
 * self-hosted Dakera memory server (https://dakera.ai).
 *
 * Usage in config.json:
 * ```json
 * {
 *   "contextProviders": [
 *     {
 *       "name": "dakera",
 *       "params": {
 *         "baseUrl": "http://localhost:3300",
 *         "apiKey": "your-api-key",
 *         "topK": 10
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * Then in the chat: `@dakera what did I implement last week in the auth module?`
 */
class DakeraContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "dakera",
    displayTitle: "Dakera Memory",
    description:
      "Recall relevant memories from your self-hosted Dakera memory server",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const baseUrl: string =
      (this.options.baseUrl as string | undefined)?.replace(/\/$/, "") ??
      "http://localhost:3300";
    const apiKey: string | undefined = this.options.apiKey as
      | string
      | undefined;
    const topK: number = (this.options.topK as number | undefined) ?? 10;
    const sessionId: string | undefined = this.options.sessionId as
      | string
      | undefined;

    const searchUrl = `${baseUrl}/v1/memories/search`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const body: Record<string, unknown> = {
      query: query || extras.fullInput || "",
      top_k: topK,
    };
    if (sessionId) {
      body["session_id"] = sessionId;
    }

    try {
      // Use extras.fetch when available so Continue can handle proxying/auth;
      // fall back to global fetch for environments where extras.fetch is absent.
      const fetchFn: typeof fetch =
        typeof extras.fetch === "function" ? (extras.fetch as any) : fetch;

      const response = await fetchFn(searchUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.warn(
          `[DakeraContextProvider] Search request failed: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      const json = await response.json();

      // Dakera returns { memories: MemoryRecord[] } or a bare array.
      const records: any[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.memories)
          ? json.memories
          : [];

      return records.map((record: any, index: number) => {
        const text: string =
          record.content ??
          record.text ??
          record.value ??
          JSON.stringify(record);
        const id: string = record.id ?? record.memory_id ?? String(index);
        const importance: number | undefined =
          record.importance ?? record.score;
        const importanceLabel =
          importance !== undefined
            ? ` (relevance: ${(importance * 100).toFixed(0)}%)`
            : "";

        return {
          name: `Memory ${id}${importanceLabel}`,
          description: `Dakera memory retrieved for: ${query || extras.fullInput}`,
          content: text,
        } satisfies ContextItem;
      });
    } catch (e) {
      console.warn(
        `[DakeraContextProvider] Failed to retrieve memories from ${searchUrl}:`,
        e,
      );
      return [];
    }
  }
}

export default DakeraContextProvider;
