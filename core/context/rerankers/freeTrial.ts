import fetch from "node-fetch";

import { getHeaders } from "../../continueServer/stubs/headers.js";
import { TRIAL_PROXY_URL } from "../../control-plane/client.js";
import { Chunk } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";

export class FreeTrialReranker extends BaseLLM {
  static providerName = "free-trial";

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (chunks.length === 0) {
      return [];
    }
    const resp = await fetch(new URL("rerank", TRIAL_PROXY_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getHeaders()),
      },
      body: JSON.stringify({
        query,
        documents: chunks.map((chunk) => chunk.content),
      }),
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    const results = data.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.relevance_score);
  }
}
