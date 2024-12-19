import { getBasename } from "../../util";

import { ToolImpl } from ".";

export const readFileImpl: ToolImpl = async (args, extras) => {
  const content = await extras.ide.readFile(args.filepath);
  return [
    {
      name: getBasename(args.filepath),
      description: args.filepath,
      content,
    },
  ];
};
