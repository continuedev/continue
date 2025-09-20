import {
  performFindAndReplace,
  validateSingleEdit,
} from "core/edit/searchAndReplace/findAndReplaceUtils";
import { ContinueError, ContinueErrorReason } from "core/util/errors";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";

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

  const streamId = uuid();

  // Validate arguments
  if (!filepath) {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceMissingFilepath,
      "filepath is required",
    );
  }
  validateSingleEdit(old_string, new_string);

  // Resolve the file path
  const resolvedFilepath = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );
  if (!resolvedFilepath) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `File ${filepath} does not exist`,
    );
  }

  // Read the current file content
  const originalContent =
    editingFileContents ??
    (await extras.ideMessenger.ide.readFile(resolvedFilepath));

  // Perform the find and replace operation
  const newContent = performFindAndReplace(
    originalContent,
    old_string,
    new_string,
    replace_all,
  );

  // Apply the changes to the file
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newContent,
      filepath: resolvedFilepath,
      isSearchAndReplace: true,
    }),
  );

  // Return success - applyToFile will handle the completion state
  return {
    respondImmediately: false, // Let apply state handle completion
    output: undefined,
  };
};
