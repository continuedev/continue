import {
  inferResolvedUriFromRelativePath,
  resolveRelativePathInDir,
} from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import type { IIdeMessenger } from "../../context/IdeMessenger";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
import {
  performFindAndReplace,
  validateCreatingForMultiEdit,
  validateSingleEdit,
} from "./findAndReplaceUtils";

export async function validateAndEnhanceMultiEditArgs(
  args: Record<string, any>,
  ideMessenger: IIdeMessenger,
): Promise<Record<string, any>> {
  const { filepath, edits } = args;
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

  const isCreatingNewFile = validateCreatingForMultiEdit(edits);

  // Check if this is creating a new file (first edit has empty old_string)
  const resolvedUri = await resolveRelativePathInDir(
    filepath,
    ideMessenger.ide,
  );

  let editingFileContents: string;
  let newContent: string;
  let fileUri: string;
  if (isCreatingNewFile) {
    if (resolvedUri) {
      throw new Error(
        `file ${filepath} already exists, cannot create new file`,
      );
    }
    editingFileContents = "";
    newContent = edits[0].new_string;
    const dirs = await ideMessenger.ide.getWorkspaceDirs();
    fileUri = await inferResolvedUriFromRelativePath(
      filepath,
      ideMessenger.ide,
      dirs,
    );
  } else {
    if (!resolvedUri) {
      throw new Error(
        `file ${filepath} does not exist. If you are trying to edit it, correct the filepath. If you are trying to create it, you must pass old_string=""`,
      );
    }
    fileUri = resolvedUri;
    editingFileContents = await ideMessenger.ide.readFile(resolvedUri);
    newContent = editingFileContents;

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

  return {
    filepath,
    edits,
    fileUri,
    editingFileContents,
    newContent,
  };
}

export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  // This is done AGAIN to avoid situation where user edits file while tool call is pending
  const { fileUri, newContent } = await validateAndEnhanceMultiEditArgs(
    args,
    extras.ideMessenger,
  );

  const streamId = uuid();

  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newContent,
      filepath: fileUri,
      isSearchAndReplace: true,
    }),
  );

  return {
    respondImmediately: false, // Let apply state handle completion
    output: undefined,
  };
};
