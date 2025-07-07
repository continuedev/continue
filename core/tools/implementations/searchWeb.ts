import { ToolImpl } from ".";
import { fetchSearchResults } from "../../context/providers/WebContextProvider";

const DEFAULT_WEB_SEARCH_CHAR_LIMIT = 8000;

export const searchWebImpl: ToolImpl = async (args, extras) => {
  const webResults = await fetchSearchResults(args.query, 5, extras.fetch);

  // Track truncated results
  const truncatedResults: string[] = [];

  // Check and truncate each result
  const processedResults = webResults.map((result, index) => {
    if (result.content.length > DEFAULT_WEB_SEARCH_CHAR_LIMIT) {
      truncatedResults.push(
        result.name || result.description || `Result #${index + 1}`,
      );
      return {
        ...result,
        content: result.content.substring(0, DEFAULT_WEB_SEARCH_CHAR_LIMIT),
      };
    }
    return result;
  });

  // Add truncation warning if needed
  if (truncatedResults.length > 0) {
    processedResults.push({
      name: "Web search truncation warning",
      description: "Informs that search results were truncated",
      content: `The content from the following search results was truncated because it exceeded the ${DEFAULT_WEB_SEARCH_CHAR_LIMIT} character limit: ${truncatedResults.join(", ")}. For more detailed information, consider refining your search query.`,
    });
  }

  return processedResults;
};
