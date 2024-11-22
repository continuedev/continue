import { Tool } from "..";
import generateRepoMap from "../util/generateRepoMap";

export const viewSubdirectoryTool: Tool = {
  type: "function",
  action: async (args: any, extras) => {
    const { directory_path } = args;
    const repoMap = await generateRepoMap(extras.llm, extras.ide, {
      dirs: [directory_path],
    });
    return [
      {
        name: "Repo map",
        description: `Map of ${directory_path}`,
        content: repoMap,
      },
    ];
  },
  function: {
    name: "view_subdirectory",
    description: "View the contents of a subdirectory",
    parameters: {
      type: "object",
      required: ["directory_path"],
      properties: {
        directory_path: {
          type: "string",
          description: "The path of the subdirectory to view",
        },
      },
    },
  },
};
