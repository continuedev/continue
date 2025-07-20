import { inferResolvedUriFromRelativePath } from "../../util/ideUtils";

import { ToolImpl } from ".";
import { getCleanUriPath, getUriPathBasename } from "../../util/uri";

export const createNewFileImpl: ToolImpl = async (args, extras) => {
  if (!args?.filepath) {
    throw new Error("`filepath` argument is required and cannot be empty.");
  }
  if (args?.contents === undefined) {
    throw new Error(
      "`contents` argument is required to create a new file (can be empty).",
    );
  }
  const resolvedFileUri = await inferResolvedUriFromRelativePath(
    args.filepath,
    extras.ide,
  );
  if (resolvedFileUri) {
    const exists = await extras.ide.fileExists(resolvedFileUri);
    if (exists) {
      throw new Error(
        `File ${args.filepath} already exists. Use the edit tool to edit this file`,
      );
    }
    await extras.ide.writeFile(resolvedFileUri, args.contents);
    await extras.ide.openFile(resolvedFileUri);
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
    throw new Error("Failed to resolve path");
  }
};
