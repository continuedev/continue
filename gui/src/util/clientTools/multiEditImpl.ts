import {
  inferResolvedUriFromRelativePath,
  resolveRelativePathInDir,
} from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
import {
  performFindAndReplace,
  validateSingleEdit,
} from "./findAndReplaceUtils";

interface EditOperation {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export function validateCreating(edits: EditOperation[]) {
  const isCreating = edits[0].old_string === "";
  if (edits.length > 1) {
    if (isCreating) {
      throw new Error(
        "cannot make subsequent edits on a file you are creating",
      );
    } else {
      for (let i = 1; i < edits.length; i++) {
        if (edits[i].old_string === "") {
          throw new Error(
            `edit #${i + 1}: only the first edit can contain an empty old_string, which is only used for file creation.`,
          );
        }
      }
    }
  }

  return isCreating;
}
export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, edits } = args;

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
  const isCreatingNewFile = validateCreating(edits);
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
    const response = await extras.ideMessenger.request(
      "getWorkspaceDirs",
      undefined,
    );
    if (response.status === "error") {
      throw new Error(
        "Error getting workspace directories to infer file creation path",
      );
    }
    fileUri = await inferResolvedUriFromRelativePath(
      filepath,
      extras.ideMessenger.ide,
      response.content,
    );
  } else {
    if (!resolvedUri) {
      throw new Error(
        `file ${filepath} does not exist. If you are trying to edit it, correct the filepath. If you are trying to create it, you must pass old_string=""`,
      );
    }
    newContent = await extras.ideMessenger.ide.readFile(resolvedUri);
    fileUri = resolvedUri;
    for (let i = 0; i < edits.length; i++) {
      const { old_string, new_string, replace_all } = edits[i];
      newContent = performFindAndReplace(
        old_string,
        edits[0],
        new_string,
        replace_all,
        i,
      );
    }
  }

  try {
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
  } catch (error) {
    throw new Error(
      `Failed to apply multi edit: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
