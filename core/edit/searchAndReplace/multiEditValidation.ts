import { EditOperation } from "../../tools/definitions/multiEdit";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { validateSingleEdit } from "./findAndReplaceUtils";

export interface MultiEditValidationResult {
  edits: EditOperation[];
}

/**
 * Validates multi edit arguments (non-file system specific)
 */
export function validateMultiEditArgs(args: any): MultiEditValidationResult {
  const { edits } = args;

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

  return { edits };
}

/**
 * Validates all edits in the array
 */
export function validateAllEdits(edits: EditOperation[]): void {
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];

    // Use existing validation
    validateSingleEdit(edit.old_string, edit.new_string, i);

    // Only the first edit can have empty old_string (for insertion at beginning)
    if (i > 0 && edit.old_string === "") {
      throw new ContinueError(
        ContinueErrorReason.FindAndReplaceMissingOldString,
        `Edit at index ${i}: old_string cannot be empty. Only the first edit can have an empty old_string for insertion at the beginning of the file.`,
      );
    }
  }
}
