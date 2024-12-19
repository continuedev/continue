import { getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";
import { resolveRelativePathInDir } from "../../util/ideUtils";

export const readFileImpl: ToolImpl = async (args, extras) => {
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    extras.ide,
  );
  if (!firstUriMatch) {
    throw new Error(`Could not find file ${args.filepath}`);
  }
  const content = await extras.ide.readFile(firstUriMatch);
  return [
    {
      name: getUriPathBasename(args.filepath),
      description: args.filepath,
      content,
    },
  ];
};
