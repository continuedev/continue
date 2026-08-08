import { Chunk } from "../../index.js";
import { getUriPathBasename } from "../../util/uri.js";
import { BaseLLM } from "../index.js";

const RERANK_PROMPT = (
  query: string,
  documentId: string,
  document: string,
) => `You are an expert software developer responsible for helping detect whether the retrieved snippet of code is relevant to the query. For a given input, you need to output a single word: "Yes" or "No" indicating the retrieved snippet is relevant to the query.

  Query: Where is the FastAPI server?
  Snippet:
  \`\`\`/Users/andrew/Desktop/server/main.py
  from fastapi import FastAPI
  app = FastAPI()
  @app.get("/")
  def read_root():
      return {{"Hello": "World"}}
  \`\`\`
  Relevant: Yes

  Query: Where in the documentation does it talk about the UI?
  Snippet:
  \`\`\`/Users/andrew/Projects/bubble_sort/src/lib.rs
  fn bubble_sort<T: Ord>(arr: &mut [T]) {{
      for i in 0..arr.len() {{
          for j in 1..arr.len() - i {{
              if arr[j - 1] > arr[j] {{
                  arr.swap(j - 1, j);
              }}
          }}
      }}
  }}
  \`\`\`
  Relevant: No

  Query: ${query}
  Snippet:
  \`\`\`${documentId}
  ${document}
  \`\`\`
  Relevant:
  `;

export class LLMReranker extends BaseLLM {
  static providerName = "llmReranker";

  async scoreChunk(chunk: Chunk, query: string): Promise<number> {
    const completion = await this.complete(
      RERANK_PROMPT(query, getUriPathBasename(chunk.filepath), chunk.content),
      new AbortController().signal,
      {
        maxTokens: 1,
        model:
          this.providerName.startsWith("openai") &&
          this.model.startsWith("gpt-4")
            ? "gpt-3.5-turbo"
            : this.model,
      },
    );

    if (!completion) {
      // TODO: Why is this happening?
      return 0.0;
    }

    const answer = completion
      .trim()
      .toLowerCase()
      .replace(/"/g, "")
      .replace(/'/g, "");

    if (answer === "yes") {
      return 1.0;
    }
    if (answer === "no") {
      return 0.0;
    }
    console.warn(
      `Unexpected response from single token reranker: "${answer}". Expected "yes" or "no".`,
    );
    return 0.0;
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const scores = await Promise.all(
      chunks.map((chunk) => this.scoreChunk(chunk, query)),
    );
    return scores;
  }
}
