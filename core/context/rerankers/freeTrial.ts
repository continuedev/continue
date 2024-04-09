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
    const data = await resp.json();
    const results = data.data.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.relevance_score);
  }
}
