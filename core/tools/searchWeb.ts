import { Tool } from "..";
import { fetchSearchResults } from "../context/providers/WebContextProvider";

export const searchWebTool: Tool = {
  type: "function",
  action: async (args, extras) => {
    const webResults = await fetchSearchResults(args.query, 5, extras.fetch);
    return webResults;
  },
  function: {
    name: "search_web",
    description:
      "Performs a web search, returning top results. This tool should only be called for questions that require external knowledge. Common programming questions do not require web search.",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        repo_url: {
          type: "string",
          description: "The natural language search query",
        },
      },
    },
  },
};
