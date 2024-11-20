import { Tool } from "..";
import generateRepoMap from "../util/generateRepoMap";

export const viewRepoMapTool: Tool = {
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
      properties: {},
    },
  },
};
