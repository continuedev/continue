import { ToolImpl } from ".";
import { RangeInFile } from "../..";
import { retrieveContextItemsFromEmbeddings } from "../../context/retrieval/retrieval";

export const codebaseToolImpl: ToolImpl = async (args, extras) => {
  if (!args.query || args.query.trim() === "") {
    return [
      {
        name: "Error",
        description: "Codebase search error",
        content: "Query parameter is required and cannot be empty.",
      },
    ];
  }

  try {
    const contextExtras = {
      config: extras.config,
      fullInput: args.query,
      embeddingsProvider: extras.config.selectedModelByRole.embed,
      reranker: extras.config.selectedModelByRole.rerank,
      llm: extras.llm,
      ide: extras.ide,
      selectedCode: [] as RangeInFile[],
      fetch: extras.fetch,
      isInAgentMode: true, // always true in tool call
    };

    // Use the existing retrieval function to get context items
    const results = await retrieveContextItemsFromEmbeddings(
      contextExtras,
      undefined,
      undefined,
    );

    // If no results found, return helpful message
    if (results.length === 0) {
      return [
        {
          name: "No Results",
          description: "Codebase search",
          content: `No relevant code found for query: "${args.query}". This could mean:
- The codebase hasn't been indexed yet
- No code matches the search criteria
- Embeddings provider is not configured

Try re-indexing the codebase or using a more specific query.`,
        },
      ];
    }

    return results;
  } catch (error) {
    return [
      {
        name: "Error",
        description: "Codebase search error",
        content: `Failed to search codebase: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
};
