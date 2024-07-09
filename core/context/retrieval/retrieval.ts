import {
  BranchAndDir,
  ContextItem,
  ContextProviderExtras,
} from "../../index.js";

import { getRelativePath } from "../../util/index.js";
import { RETRIEVAL_PARAMS } from "../../util/parameters.js";
import { RetrievalPipelineOptions } from "./pipelines/BaseRetrievalPipeline.js";
import NoRerankerRetrievalPipeline from "./pipelines/NoRerankerRetrievalPipeline.js";
import RerankerRetrievalPipeline from "./pipelines/RerankerRetrievalPipeline.js";

export async function retrieveContextItemsFromEmbeddings(
  extras: ContextProviderExtras,
  options: any | undefined,
  filterDirectory: string | undefined,
): Promise<ContextItem[]> {
  if (!extras.embeddingsProvider) {
    return [];
  }

  // transformers.js not supported in JetBrains IDEs right now
  if (
    extras.embeddingsProvider.id === "all-MiniLM-L6-v2" &&
    (await extras.ide.getIdeInfo()).ideType === "jetbrains"
  ) {
    throw new Error(
      "The transformers.js context provider is not currently supported in JetBrains. For now, you can use Ollama to set up local embeddings, or use our 'free-trial' embeddings provider. See here to learn more: https://docs.continue.dev/walkthroughs/codebase-embeddings#embeddings-providers",
    );
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

  const pipelineType = useReranking
    ? RerankerRetrievalPipeline
    : NoRerankerRetrievalPipeline;
  const pipelineOptions: RetrievalPipelineOptions = {
    nFinal,
    nRetrieve,
    tags,
    embeddingsProvider: extras.embeddingsProvider,
    reranker: extras.reranker,
    filterDirectory,
    ide: extras.ide,
    input: extras.fullInput,
  };
  const pipeline = new pipelineType(pipelineOptions);
  const results = await pipeline.run();

  if (results.length === 0) {
    throw new Error(
      "Warning: No results found for @codebase context provider.",
    );
  }

  return [
    ...results.map((r) => {
      const name = `${getRelativePath(r.filepath, workspaceDirs)} (${r.startLine}-${r.endLine})`;
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
