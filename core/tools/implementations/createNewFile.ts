import { inferResolvedUriFromRelativePath } from "../../util/ideUtils";

import { ToolImpl } from ".";

export const createNewFileImpl: ToolImpl = async (args, extras) => {
  const resolvedFileUri = await inferResolvedUriFromRelativePath(
    args.filepath,
    extras.ide,
  );
  if (resolvedFileUri) {
    await extras.ide.writeFile(resolvedFileUri, args.contents);
    await extras.ide.openFile(resolvedFileUri);
  }
  return [];
};
