import { Tool } from "..";
import { fetchSearchResults } from "../context/providers/WebContextProvider";

export const searchWebTool: Tool = {
  type: "function",
  action: async (args, extras) => {
    const webResults = await fetchSearchResults(args.query, 5, extras.fetch);
    return webResults.map((result) => result.content).join("\n\n");
  },
  function: {
    name: "search_web",
    description: "Perform a web search and get back top results",
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
