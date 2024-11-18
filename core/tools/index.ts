import { IDE, Tool } from "..";

export const makeCreateNewFileTool = (ide: IDE): Tool => ({
  type: "function",
  action: async (...args: any) => {
    await ide.writeFile(args[0], args[1]);
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
