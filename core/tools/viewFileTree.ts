import { Tool } from "..";
import generateRepoMap from "../util/generateRepoMap";

export const viewFileTreeTool: Tool = {
  type: "function",
  action: async (args, extras) => {
    const repoMap = await generateRepoMap(extras.llm, extras.ide, {});
    return repoMap;
  },
  function: {
    name: "view_repo_map",
    description: "View the repository map",
    parameters: {
      type: "object",
      required: ["repo_url"],
      properties: {
        repo_url: {
          type: "string",
          description: "The URL of the repository to view",
        },
      },
    },
  },
};
