import { inferResolvedUriFromRelativePath } from "../../util/ideUtils";

import { ToolImpl } from ".";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getCleanUriPath, getUriPathBasename } from "../../util/uri";
import { getStringArg } from "../parseArgs";

export const createNewFileImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");
  const contents = getStringArg(args, "contents", true);

  const resolvedFileUri = await inferResolvedUriFromRelativePath(
    filepath,
    extras.ide,
  );
  if (resolvedFileUri) {
    const exists = await extras.ide.fileExists(resolvedFileUri);
    if (exists) {
      throw new ContinueError(
        ContinueErrorReason.FileAlreadyExists,
        `File ${filepath} already exists. Use the edit tool to edit this file`,
      );
    }
    await extras.ide.writeFile(resolvedFileUri, contents);
    await extras.ide.openFile(resolvedFileUri, { preserveFocus: true });
    await extras.ide.saveFile(resolvedFileUri);
    if (extras.codeBaseIndexer) {
      void extras.codeBaseIndexer?.refreshCodebaseIndexFiles([resolvedFileUri]);
    }
    return [
      {
        name: getUriPathBasename(resolvedFileUri),
        description: getCleanUriPath(resolvedFileUri),
        content: "File created successfuly",
        uri: {
          type: "file",
          value: resolvedFileUri,
        },
      },
    ];
  } else {
    throw new ContinueError(
      ContinueErrorReason.PathResolutionFailed,
      "Failed to resolve path",
    );
  }
};
