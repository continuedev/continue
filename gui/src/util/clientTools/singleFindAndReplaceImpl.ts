import { IDE } from "core";
import { validateSingleEdit } from "core/edit/searchAndReplace/findAndReplaceUtils";
import { executeFindAndReplace } from "core/edit/searchAndReplace/performReplace";
import { ContinueError, ContinueErrorReason } from "core/util/errors";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";

export async function validateSearchAndReplaceFilepath(
  filepath: any,
  ide: IDE,
) {
  if (!filepath || typeof filepath !== "string") {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceMissingFilepath,
      "filepath (string) is required",
    );
  }
  const resolvedFilepath = await resolveRelativePathInDir(filepath, ide);
  if (!resolvedFilepath) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `File ${filepath} does not exist`,
    );
  }
  return resolvedFilepath;
}

export const singleFindAndReplaceImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const {
    filepath,
    old_string,
    new_string,
    replace_all = false,
    editingFileContents,
  } = args;

  const resolvedUri = await validateSearchAndReplaceFilepath(
    filepath,
    extras.ideMessenger.ide,
  );
  validateSingleEdit(old_string, new_string);

  // Read the current file content
  const originalContent =
    editingFileContents ??
    (await extras.ideMessenger.ide.readFile(resolvedUri));

  // Perform the find and replace operation
  const newContent = executeFindAndReplace(
    originalContent,
    old_string,
    new_string,
    replace_all,
    0,
  );

  // Apply the changes to the file
  const streamId = uuid();
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newContent,
      filepath: resolvedUri,
      isSearchAndReplace: true,
    }),
  );

  // Return success - applyToFile will handle the completion state
  return {
    respondImmediately: false, // Let apply state handle completion
    output: undefined,
  };
};
