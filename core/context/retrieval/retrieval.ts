import { BranchAndDir, ContextItem, ContextProviderExtras } from "../../";
import { getUriDescription } from "../../util/uri";
import { INSTRUCTIONS_BASE_ITEM } from "../providers/utils";

import { RetrievalPipelineOptions } from "./pipelines/BaseRetrievalPipeline";
import NoRerankerRetrievalPipeline from "./pipelines/NoRerankerRetrievalPipeline";
import RerankerRetrievalPipeline from "./pipelines/RerankerRetrievalPipeline";

const DEFAULT_N_FINAL = 25;

export async function retrieveContextItemsFromEmbeddings(
  extras: ContextProviderExtras,
  options: any | undefined,
  filterDirectory: string | undefined,
): Promise<ContextItem[]> {
  // Currently you can use codebase without an embeddings provider and it will just skip the embeddings inputs
  // if (!extras.embeddingsProvider) {
  //   void extras.ide.showToast(
  //     "warning",
  //     "Set up an embeddings model to use this feature. Visit the docs to learn more: " +
  //       "https://docs.continue.dev/customize/model-types/embeddings",
  //   );
  //   return [];
  // }
  const includeEmbeddings = !!extras.config.selectedModelByRole.embed;

  // Get tags to retrieve for
  const workspaceDirs = await extras.ide.getWorkspaceDirs();

  if (workspaceDirs.length === 0) {
    throw new Error("No workspace directories found");
  }

  // Fill half of the context length, up to a max of 100 snippets
  const contextLength = extras.llm.contextLength;
  const tokensPerSnippet = 512;
  const nFinal =
    options?.nFinal ??
    Math.min(DEFAULT_N_FINAL, contextLength / tokensPerSnippet / 2);
  const useReranking = !!extras.reranker;
  const nRetrieve = useReranking ? options?.nRetrieve || 2 * nFinal : nFinal;

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

  const pipelineType = useReranking
    ? RerankerRetrievalPipeline
    : NoRerankerRetrievalPipeline;

  const pipelineOptions: RetrievalPipelineOptions = {
    nFinal,
    nRetrieve,
    tags,
    filterDirectory,
    ide: extras.ide,
    input: extras.fullInput,
    llm: extras.llm,
    config: extras.config,
  };

  const pipeline = new pipelineType(pipelineOptions);
  const results = await pipeline.run({
    tags,
    filterDirectory,
    query: extras.fullInput,
    includeEmbeddings,
  });

  if (results.length === 0) {
    if (extras.config.disableIndexing) {
      void extras.ide.showToast("warning", "No results found.");
      return [];
    } else {
      void extras.ide.showToast(
        "warning",
        "No results found. If you think this is an error, re-index your codebase.",
      );
      // TODO - add "re-index" option to warning message which clears and reindexes codebase
    }
    return [];
  }

  return [
    {
      ...INSTRUCTIONS_BASE_ITEM,
      content:
        "Use the above code to answer the following question. You should not reference any files outside of what is shown, unless they are commonly known files, like a .gitignore or package.json. Reference the filenames whenever possible. If there isn't enough information to answer the question, suggest where the user might look to learn more.",
    },
    ...results
      .sort((a, b) => a.filepath.localeCompare(b.filepath))
      .map((r) => {
        const { relativePathOrBasename, last2Parts, baseName } =
          getUriDescription(r.filepath, workspaceDirs);

        if (baseName === "package.json") {
          console.warn("Retrieval pipeline: package.json detected");
        }

        return {
          name: `${baseName} (${r.startLine + 1}-${r.endLine + 1})`,
          description: last2Parts,
          content: `\`\`\`${relativePathOrBasename}\n${r.content}\n\`\`\``,
          uri: {
            type: "file" as const,
            value: r.filepath,
          },
        };
      }),
  ];
}
