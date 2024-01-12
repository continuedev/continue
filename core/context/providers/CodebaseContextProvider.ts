import { BaseContextProvider } from "..";
import {
  Chunk,
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ILLM,
  ModelProvider,
} from "../..";
import { ExtensionIde } from "../../ide";
import { getBasename } from "../../util";

const RERANK_PROMPT = (
  query: string,
  documentId: string,
  document: string
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

const PARALLEL_PROVIDERS: ModelProvider[] = [
  "anthropic",
  "bedrock",
  "deepinfra",
  "gemini",
  "google-palm",
  "huggingface-inference-api",
  "huggingface-tgi",
  "mistral",
  "free-trial",
  "replicate",
  "together",
];

function llmCanGenerateInParallel(llm: ILLM): boolean {
  if (llm.providerName === "openai") {
    return llm.model.includes("gpt");
  }

  return PARALLEL_PROVIDERS.includes(llm.providerName);
}

async function scoreChunk(
  chunk: Chunk,
  llm: ILLM,
  query: string
): Promise<number> {
  const completion = await llm.complete(
    RERANK_PROMPT(query, getBasename(chunk.filepath), chunk.content),
    {
      maxTokens: 1,
      model:
        llm.providerName.startsWith("openai") && llm.model.startsWith("gpt-4")
          ? "gpt-3.5-turbo"
          : llm.model,
    }
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
      `Unexpected response from single token reranker: "${answer}". Expected "yes" or "no".`
    );
    return 0.0;
  }
}

async function rerank(
  chunks: Chunk[],
  llm: ILLM,
  query: string,
  nFinal: number
): Promise<Chunk[]> {
  const scores = await Promise.all(
    chunks.map((chunk) => scoreChunk(chunk, llm, query))
  );
  const sorted = chunks
    .map((chunk, i) => ({ chunk, score: scores[i] }))
    .sort((a, b) => b.score - a.score);

  return sorted.map((s) => s.chunk).slice(0, nFinal);
}

class CodebaseContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files",
    dynamic: false,
    requiresQuery: false,
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    if (!extras.embeddingsProvider) {
      return [];
    }

    const nRetrieve = this.options.nRetrieve || 20;
    const nFinal = this.options.nFinal || 10;
    const useReranking =
      llmCanGenerateInParallel(extras.llm) &&
      (this.options.useReranking === undefined
        ? false
        : this.options.useReranking);

    // Similarity search
    const [v] = await extras.embeddingsProvider.embed([extras.fullInput]);
    let results = await new ExtensionIde().retrieveChunks(
      v,
      useReranking === false ? nFinal : nRetrieve,
      [],
      extras.embeddingsProvider.id
    );

    // Re-ranking
    if (useReranking) {
      results = await rerank(results, extras.llm, query, nFinal);
    }

    return [
      ...results.map((r) => {
        const name = `${getBasename(r.filepath)} (${r.startLine}-${r.endLine})`;
        const description = `${r.filepath} (${r.startLine}-${r.endLine})`;
        return {
          name,
          description,
          content: `\`\`\`${name}\n${r.content}\n\`\`\``,
        };
      }),
      {
        name: "Instructions",
        description: "Instructions",
        content:
          "Use the above code to answer the following question. You should not reference any files outside of what is shown, unless they are commonly known files, like a .gitignore or package.json. Reference the filenames whenever possible. If there isn't enough information to answer the question, suggest where the user might look to learn more.",
      },
    ];
  }
  async load(): Promise<void> {}
}

export default CodebaseContextProvider;
