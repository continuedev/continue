import {
  performFindAndReplace,
  validateSingleEdit,
} from "core/edit/searchAndReplace/findAndReplaceUtils";
import { ContinueError, ContinueErrorReason } from "core/util/errors";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";

export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, edits, editingFileContents } = args;

  const streamId = uuid();

  // Validate arguments
  if (!filepath) {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceMissingFilepath,
      "filepath is required",
    );
  }
  if (!edits || !Array.isArray(edits)) {
    throw new ContinueError(
      ContinueErrorReason.MultiEditEditsArrayRequired,
      "edits array is required",
    );
  }
  if (edits.length === 0) {
    throw new ContinueError(
      ContinueErrorReason.MultiEditEditsArrayEmpty,
      "edits array must contain at least one edit",
    );
  }

  // Validate each edit operation
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    validateSingleEdit(edit.old_string, edit.new_string, i);
  }

  // Validate that no edit has empty old_string (file creation not allowed)
  for (let i = 0; i < edits.length; i++) {
    if (edits[i].old_string === "") {
      throw new ContinueError(
        ContinueErrorReason.FindAndReplaceMissingOldString,
        `edit at index ${i}: old_string cannot be empty. File creation is not allowed.`,
      );
    }
  }

  const resolvedUri = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );

  if (!resolvedUri) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `file ${filepath} does not exist`,
    );
  }

  let newContent =
    editingFileContents ??
    (await extras.ideMessenger.ide.readFile(resolvedUri));
  const fileUri = resolvedUri;

  for (let i = 0; i < edits.length; i++) {
    const { old_string, new_string, replace_all } = edits[i];
    newContent = performFindAndReplace(
      newContent,
      old_string,
      new_string,
      replace_all,
      i,
    );
  }

  // Apply the changes to the file
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newContent,
      filepath: fileUri,
      isSearchAndReplace: true,
    }),
  );

  // Return success - applyToFile will handle the completion state
  return {
    respondImmediately: false, // Let apply state handle completion
    output: undefined,
  };
};
