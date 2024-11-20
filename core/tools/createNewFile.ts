import { Tool } from "..";
import { getPathModuleForIde } from "../util/pathModule";
import { ToolParams } from "./types";

export const makeCreateNewFileTool = ({ ide }: ToolParams): Tool => ({
  type: "function",
  action: async (args: any) => {
    const pathSep = await ide.pathSep();
    let filepath = args.filepath;
    if (!args.filepath.startsWith(pathSep)) {
      const pathModule = await getPathModuleForIde(ide);
      const workspaceDirs = await ide.getWorkspaceDirs();
      const cwd = workspaceDirs[0];
      filepath = pathModule.join(cwd, filepath);
    }
    await ide.writeFile(filepath, args.contents);
    await ide.openFile(filepath);
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
});
