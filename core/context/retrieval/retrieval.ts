import { BranchAndDir, Chunk, ContextItem, ContextProviderExtras } from "../..";
import { LanceDbIndex } from "../../indexing/LanceDbIndex";

import { deduplicateArray, getBasename } from "../../util";
import { RETRIEVAL_PARAMS } from "../../util/parameters";
import { retrieveFts } from "./fullTextSearch";

function deduplicateChunks(chunks: Chunk[]): Chunk[] {
  return deduplicateArray(chunks, (a, b) => {
    return (
      a.filepath === b.filepath &&
      a.startLine === b.startLine &&
      a.endLine === b.endLine
    );
  });
}

export async function retrieveContextItemsFromEmbeddings(
  extras: ContextProviderExtras,
  options: any | undefined,
  filterDirectory: string | undefined,
): Promise<ContextItem[]> {
  if (!extras.embeddingsProvider) {
    return [];
  }

  const nFinal = options?.nFinal || RETRIEVAL_PARAMS.nFinal;
  const useReranking = extras.reranker !== undefined;
  const nRetrieve =
    useReranking === false
      ? nFinal
      : options?.nRetrieve || RETRIEVAL_PARAMS.nRetrieve;

  // Get tags to retrieve for
  const workspaceDirs = await extras.ide.getWorkspaceDirs();

  if (workspaceDirs.length === 0) {
    throw new Error("No workspace directories found");
  }

  const branches = (await Promise.race([
    Promise.all(workspaceDirs.map((dir) => extras.ide.getBranch(dir))),
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(["NONE"]);
      }, 500);
    }),
  ])) as string[];
  const tags: BranchAndDir[] = workspaceDirs.map((directory, i) => ({
    directory,
    branch: branches[i],
  }));

  // Get all retrieval results
  const retrievalResults: Chunk[] = [];

  // Source: Full-text search
  let ftsResults = await retrieveFts(
    extras.fullInput,
    nRetrieve / 2,
    tags,
    filterDirectory,
  );
  retrievalResults.push(...ftsResults);

  // Source: expansion with code graph
  // consider doing this after reranking? Or just having a lower reranking threshold
  // This is VS Code only until we use PSI for JetBrains or build our own general solution
  if ((await extras.ide.getIdeInfo()).ideType === "vscode") {
    const { expandSnippet } = await import(
      "../../../extensions/vscode/src/util/expandSnippet"
    );
    let expansionResults = (
      await Promise.all(
        extras.selectedCode.map(async (rif) => {
          return expandSnippet(
            rif.filepath,
            rif.range.start.line,
            rif.range.end.line,
            extras.ide,
          );
        }),
      )
    ).flat() as Chunk[];
    retrievalResults.push(...expansionResults);
  }

  // Source: Open file exact match
  // Source: Class/function name exact match

  // Source: Embeddings
  const lanceDbIndex = new LanceDbIndex(extras.embeddingsProvider, (path) =>
    extras.ide.readFile(path),
  );
  let vecResults = await lanceDbIndex.retrieve(
    extras.fullInput,
    nRetrieve,
    tags,
    filterDirectory,
  );
  retrievalResults.push(...vecResults);

  // De-duplicate
  let results: Chunk[] = deduplicateChunks(retrievalResults);

  // Re-rank
  if (useReranking && extras.reranker) {
    let scores: number[] = await extras.reranker.rerank(
      extras.fullInput,
      results,
    );

    // Filter out low-scoring results
    results = results.filter(
      (_, i) => scores[i] >= RETRIEVAL_PARAMS.rerankThreshold,
    );
    scores = scores.filter(
      (score) => score >= RETRIEVAL_PARAMS.rerankThreshold,
    );

    results.sort(
      (a, b) => scores[results.indexOf(b)] - scores[results.indexOf(a)],
    );
    results = results.slice(0, nFinal);
  }

  if (results.length === 0) {
    throw new Error(
      "Warning: No results found for @codebase context provider.",
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
