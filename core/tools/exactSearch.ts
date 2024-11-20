import { Tool } from "..";

export const exactSearchTool: Tool = {
  type: "function",
  action: async (args, extras) => {
    const results = await extras.ide.getSearchResults(args.query);
    return results;
  },
  function: {
    name: "exact_search",
    description: "Perform an exact search over the repository using ripgrep",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The search query to use",
        },
      },
    },
  },
};
