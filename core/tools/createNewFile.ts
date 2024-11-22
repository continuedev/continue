import { Tool } from "..";
import { getPathModuleForIde } from "../util/pathModule";

export const createNewFileTool: Tool = {
  type: "function",
  action: async (args, extras) => {
    const pathSep = await extras.ide.pathSep();
    let filepath = args.filepath;
    if (!args.filepath.startsWith(pathSep)) {
      const pathModule = await getPathModuleForIde(extras.ide);
      const workspaceDirs = await extras.ide.getWorkspaceDirs();
      const cwd = workspaceDirs[0];
      filepath = pathModule.join(cwd, filepath);
    }
    await extras.ide.writeFile(filepath, args.contents);
    await extras.ide.openFile(filepath);
    return [];
  },
  function: {
    name: "create_new_file",
    description: "Create a new file",
    parameters: {
      type: "object",
      required: ["filepath", "contents"],
      properties: {
        filepath: {
          type: "string",
          description: "The path where the new file should be created",
        },
        contents: {
          type: "string",
          description: "The contents to write to the new file",
        },
      },
    },
  },
};
