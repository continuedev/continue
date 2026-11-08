import { inferResolvedUriFromRelativePath } from "../../util/ideUtils";

import { ToolImpl } from ".";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { getCleanUriPath, getUriPathBasename } from "../../util/uri";
import { getStringArg } from "../parseArgs";
import {
  newProblems,
  newProblemsItem,
  PROBLEMS_WAIT_MS,
} from "../problemsReport";
import { ContinueError, ContinueErrorReason } from "../../util/errors";

export const createNewFileImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");
  const contents = getStringArg(args, "contents", true);

  const resolvedFileUri = await inferResolvedUriFromRelativePath(
    filepath,
    extras.ide,
  );
  if (resolvedFileUri) {
    throwIfFileIsSecurityConcern(getCleanUriPath(resolvedFileUri));
    const exists = await extras.ide.fileExists(resolvedFileUri);
    if (exists) {
      throw new ContinueError(
        ContinueErrorReason.FileAlreadyExists,
        `File ${filepath} already exists. Use the edit tool to edit this file`,
      );
    }
    await extras.ide.writeFile(resolvedFileUri, contents);
    await extras.ide.openFile(resolvedFileUri);
    await extras.ide.saveFile(resolvedFileUri);
    if (extras.codeBaseIndexer) {
      void extras.codeBaseIndexer?.refreshCodebaseIndexFiles([resolvedFileUri]);
    }
    // A new file has no earlier problems, so whatever is reported is new
    const problems = await extras.ide
      .waitForProblems?.(resolvedFileUri, PROBLEMS_WAIT_MS)
      .catch(() => []);
    const problemsItem = newProblemsItem(
      filepath,
      newProblems([], problems ?? []),
    );
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
      ...(problemsItem ? [problemsItem] : []),
    ];
  } else {
    throw new ContinueError(
      ContinueErrorReason.PathResolutionFailed,
      "Failed to resolve path",
    );
  }
};
