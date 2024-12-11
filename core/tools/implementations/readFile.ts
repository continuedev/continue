import { ToolImpl } from ".";
import { getUriPathBasename } from "../../util/uri";

export const readFileImpl: ToolImpl = async (args, extras) => {
  const content = await extras.ide.readFile(args.filepath);
  return [
    {
      name: getUriPathBasename(args.filepath),
      description: args.filepath,
      content,
    },
  ];
};
