import { Chunk, ILLM, Reranker } from "../..";
import { getBasename } from "../../util";

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

export class LLMReranker implements Reranker {
  name = "llmReranker";

  constructor(private readonly llm: ILLM) {}

  async scoreChunk(chunk: Chunk, query: string): Promise<number> {
    const completion = await this.llm.complete(
      RERANK_PROMPT(query, getBasename(chunk.filepath), chunk.content),
      {
        maxTokens: 1,
        model:
          this.llm.providerName.startsWith("openai") &&
          this.llm.model.startsWith("gpt-4")
            ? "gpt-3.5-turbo"
            : this.llm.model,
      },
    );

    if (!completion) {
      // TODO: Why is this happening?
      return 0.0;
    }

    let answer = completion
      .trim()
      .toLowerCase()
      .replace(/"/g, "")
      .replace(/'/g, "");

    if (answer === "yes") {
      return 1.0;
    } else if (answer === "no") {
      return 0.0;
    } else {
      console.warn(
        `Unexpected response from single token reranker: "${answer}". Expected "yes" or "no".`,
      );
      return 0.0;
    }
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const scores = await Promise.all(
      chunks.map((chunk) => this.scoreChunk(chunk, query)),
    );
    return scores;
  }
}
