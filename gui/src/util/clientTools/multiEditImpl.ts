import {
  inferResolvedUriFromRelativePath,
  resolveRelativePathInDir,
} from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
import {
  performFindAndReplace,
  validateCreatingForMultiEdit,
  validateSingleEdit,
} from "./findAndReplaceUtils";

export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, edits, editingFileContents } = args;

  const streamId = uuid();

  // Validate arguments
  if (!filepath) {
    throw new Error("filepath is required");
  }
  if (!edits || !Array.isArray(edits) || edits.length === 0) {
    throw new Error(
      "edits array is required and must contain at least one edit",
    );
  }

  // Validate each edit operation
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    validateSingleEdit(edit.old_string, edit.new_string, i);
  }

  // Check if this is creating a new file (first edit has empty old_string)
  const isCreatingNewFile = validateCreatingForMultiEdit(edits);
  const resolvedUri = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );

  let newContent: string;
  let fileUri: string;
  if (isCreatingNewFile) {
    if (resolvedUri) {
      throw new Error(
        `file ${filepath} already exists, cannot create new file`,
      );
    }
    newContent = edits[0].new_string;
    const dirs = await extras.ideMessenger.ide.getWorkspaceDirs();
    fileUri = await inferResolvedUriFromRelativePath(
      filepath,
      extras.ideMessenger.ide,
      dirs,
    );
  } else {
    if (!resolvedUri) {
      throw new Error(
        `file ${filepath} does not exist. If you are trying to edit it, correct the filepath. If you are trying to create it, you must pass old_string=""`,
      );
    }
    newContent =
      editingFileContents ??
      (await extras.ideMessenger.ide.readFile(resolvedUri));
    fileUri = resolvedUri;
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
