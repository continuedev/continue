import { EditOperation } from "../../tools/definitions/multiEdit";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { validateSingleEdit } from "./findAndReplaceUtils";

export interface MultiEditValidationResult {
  edits: EditOperation[];
}

/**
 * Validates multi-edit arguments and all edits in a single pass
 * @param args - The arguments object containing the edits array
 * @returns Validated edits array
 * @throws ContinueError if validation fails
 */
export function validateMultiEdit(args: any): MultiEditValidationResult {
  const { edits } = args;

  // Validate that edits is a non-empty array
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

  // Validate each individual edit
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];

    // Use existing single edit validation
    validateSingleEdit(edit.old_string, edit.new_string, i);

    // Only the first edit can have empty old_string (for insertion at beginning)
    if (i > 0 && edit.old_string === "") {
      throw new ContinueError(
        ContinueErrorReason.FindAndReplaceNonFirstEmptyOldString,
        `Edit at index ${i}: old_string cannot be empty. Only the first edit can have an empty old_string for insertion at the beginning of the file.`,
      );
    }
  }

  return { edits };
}
