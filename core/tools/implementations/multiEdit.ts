import { ToolImpl } from ".";
import { executeMultiFindAndReplace } from "../../edit/searchAndReplace/performReplace";
import { validateSearchAndReplaceFilepath } from "../../edit/searchAndReplace/validateArgs";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getCleanUriPath, getUriPathBasename } from "../../util/uri";
import { EditOperation } from "../definitions/multiEdit";
import { getArrayArg, getStringArg } from "../parseArgs";

export const multiEditImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");
  const edits = getArrayArg(args, "edits") as EditOperation[];

  const fileUri = await validateSearchAndReplaceFilepath(filepath, extras.ide);

  if (!fileUri) {
    throw new ContinueError(
      ContinueErrorReason.PathResolutionFailed,
      `File ${filepath} not found`,
    );
  }

  const originalContent = await extras.ide.readFile(fileUri);
  const newContent = executeMultiFindAndReplace(originalContent, edits);

  await extras.ide.writeFile(fileUri, newContent);

  if (extras.codeBaseIndexer) {
    void extras.codeBaseIndexer.refreshCodebaseIndexFiles([fileUri]);
  }

  return [
    {
      name: getUriPathBasename(fileUri),
      description: getCleanUriPath(fileUri),
      content: `Successfully applied ${edits.length} edits to ${getCleanUriPath(fileUri)}`,
      uri: {
        type: "file",
        value: fileUri,
      },
    },
  ];
};
