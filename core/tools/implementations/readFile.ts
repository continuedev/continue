import { firstAbsUriMatch, getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";

export const readFileImpl: ToolImpl = async (args, extras) => {
  const firstUriMatch = await firstAbsUriMatch(
    args.filepath,
    await extras.ide.getWorkspaceDirs(),
  );
  const content = await extras.ide.readFile(firstUriMatch);
  return [
    {
      name: getUriPathBasename(args.filepath),
      description: args.filepath,
      content,
    },
  ];
};
