import {
  Chunk,
  ContextItem,
  ContextProviderExtras,
  ILLM,
  ModelProvider,
} from "..";
import { FullTextSearchCodebaseIndex } from "../indexing/FullTextSearch";
import { ChunkCodebaseIndex } from "../indexing/chunk/ChunkCodebaseIndex";
import { IndexTag } from "../indexing/types";
import { getBasename } from "../util";

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

export async function retrieveContextItemsFromEmbeddings(
  extras: ContextProviderExtras,
  options: any | undefined,
  filterDirectory: string | undefined
): Promise<ContextItem[]> {
  if (!extras.embeddingsProvider) {
    return [];
  }

  const nFinal = options?.nFinal || 10;
  const useReranking =
    llmCanGenerateInParallel(extras.llm) &&
    (options?.useReranking === undefined ? false : options?.useReranking);
  const nRetrieve = useReranking === false ? nFinal : options?.nRetrieve || 20;

  const ftsIndex = new FullTextSearchCodebaseIndex();
  const workspaceDirs = await extras.ide.getWorkspaceDirs();
  const branches = await Promise.all(
    workspaceDirs.map((dir) => extras.ide.getBranch(dir))
  );
  const tags: IndexTag[] = workspaceDirs.map((directory, i) => ({
    directory,
    branch: branches[i],
    artifactId: ChunkCodebaseIndex.artifactId,
  }));

  let ftsResults = await ftsIndex.retrieve(
    tags,
    extras.fullInput.trim().split(" ").join(" OR "),
    nRetrieve / 2,
    filterDirectory,
    undefined
  );

  let vecResults = await extras.ide.retrieveChunks(
    extras.fullInput,
    nRetrieve,
    filterDirectory
  );

  // Now combine these (de-duplicate) and re-rank
  let results = [...ftsResults];
  for (const vecResult of vecResults) {
    if (results.length >= nRetrieve) {
      break;
    }
    if (
      !ftsResults.find(
        (r) =>
          r.filepath === vecResult.filepath &&
          r.startLine === vecResult.startLine &&
          r.endLine === vecResult.endLine
      )
    ) {
      results.push(vecResult);
    }
  }

  // Re-ranking
  if (useReranking) {
    results = await rerank(results, extras.llm, extras.fullInput, nFinal);
  }

  if (results.length === 0) {
    throw new Error(
      "Warning: No results found for @codebase context provider."
    );
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
