import fetch from "node-fetch";
import { Chunk, Reranker } from "../..";
import { getHeaders } from "../../continueServer/stubs/headers";
import { SERVER_URL } from "../../util/parameters";

export class FreeTrialReranker implements Reranker {
  name = "free-trial";

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const resp = await fetch(new URL("rerank", SERVER_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getHeaders(),
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
