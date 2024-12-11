import { inferResolvedUriFromRelativePath } from "../../util/ideUtils";

import { ToolImpl } from ".";

export const createNewFileImpl: ToolImpl = async (args, extras) => {
  const resolvedFilepath = await inferResolvedUriFromRelativePath(
    args.filepath,
    extras.ide,
  );
  if (resolvedFilepath) {
    await extras.ide.writeFile(resolvedFilepath, args.contents);
    await extras.ide.openFile(resolvedFilepath);
  }
  return [];
};
