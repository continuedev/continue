import { Chunk, ContextItem, ContextProviderExtras, IndexTag } from "..";
import { FullTextSearchCodebaseIndex } from "../indexing/FullTextSearch";
import { LanceDbIndex } from "../indexing/LanceDbIndex";

import { getBasename } from "../util";

export async function retrieveContextItemsFromEmbeddings(
  extras: ContextProviderExtras,
  options: any | undefined,
  filterDirectory: string | undefined,
): Promise<ContextItem[]> {
  if (!extras.embeddingsProvider) {
    return [];
  }

  const nFinal = options?.nFinal || 10;
  const useReranking = extras.reranker !== undefined;
  const nRetrieve = useReranking === false ? nFinal : options?.nRetrieve || 20;

  const ftsIndex = new FullTextSearchCodebaseIndex();
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
  const tags: (artifactId: string) => IndexTag[] = (artifactId: string) =>
    workspaceDirs.map((directory, i) => ({
      directory,
      branch: branches[i],
      artifactId,
    }));

  let ftsResults: Chunk[] = [];

  try {
    if (extras.fullInput.trim() !== "") {
      ftsResults = await ftsIndex.retrieve(
        tags(ftsIndex.artifactId),
        extras.fullInput
          .trim()
          .split(" ")
          .map((element) => `"${element}"`)
          .join(" OR "),
        nRetrieve / 2,
        filterDirectory,
        undefined,
      );
    }
  } catch (e) {
    console.warn("Error retrieving from FTS:", e);
  }

  const lanceDbIndex = new LanceDbIndex(extras.embeddingsProvider, (path) =>
    extras.ide.readFile(path),
  );
  let vecResults = await lanceDbIndex.retrieve(
    tags(lanceDbIndex.artifactId),
    extras.fullInput,
    nRetrieve,
    filterDirectory,
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
          r.endLine === vecResult.endLine,
      )
    ) {
      results.push(vecResult);
    }
  }

  // Re-ranking
  if (useReranking && extras.reranker) {
    const scores: number[] = await extras.reranker.rerank(
      extras.fullInput,
      results,
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
