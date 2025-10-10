import { EditOperation } from "../../tools/definitions/multiEdit";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { findSearchMatches } from "./findSearchMatch";

export function executeFindAndReplace(
  fileContent: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
  editIndex = 0,
  filename?: string,
): string {
  const matches = findSearchMatches(fileContent, oldString, filename);

  if (matches.length === 0) {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceOldStringNotFound,
      `Edit at index ${editIndex}: string not found in file: "${oldString}"`,
    );
  }

  if (replaceAll) {
    // Apply replacements in reverse order to maintain correct positions
    let result = fileContent;
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      result =
        result.substring(0, match.startIndex) +
        newString +
        result.substring(match.endIndex);
    }
    return result;
  } else {
    // For single replacement, check for multiple matches first
    if (matches.length > 1) {
      throw new ContinueError(
        ContinueErrorReason.FindAndReplaceMultipleOccurrences,
        `Edit at index ${editIndex}: String "${oldString}" appears ${matches.length} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`,
      );
    }

    // Apply single replacement
    const match = matches[0];
    return (
      fileContent.substring(0, match.startIndex) +
      newString +
      fileContent.substring(match.endIndex)
    );
  }
}

/**
 * Validate that all edits can be applied to the original content before making any changes.
 * This prevents partial application when later edits would fail.
 */
function validateEditChain(
  fileContent: string,
  edits: EditOperation[],
  filename?: string,
): { valid: boolean; failedEditIndex?: number; error?: string } {
  // Simulate applying all edits to check if they will succeed
  let simulatedContent = fileContent;

  for (let editIndex = 0; editIndex < edits.length; editIndex++) {
    const edit = edits[editIndex];

    try {
      // Try to find matches in the simulated content
      const matches = findSearchMatches(
        simulatedContent,
        edit.old_string,
        filename,
      );

      if (matches.length === 0) {
        // This edit will fail because the string is not found
        // Check if it exists in the ORIGINAL content
        const originalMatches = findSearchMatches(
          fileContent,
          edit.old_string,
          filename,
        );

        if (originalMatches.length > 0) {
          // String exists in original but not after previous edits
          return {
            valid: false,
            failedEditIndex: editIndex,
            error: `Edit ${editIndex} will fail: string "${edit.old_string}" not found after applying previous edits. This likely means a previous edit modified or removed this string. Consider reordering edits or updating old_string to match the state after previous edits.`,
          };
        } else {
          // String doesn't exist in original either
          return {
            valid: false,
            failedEditIndex: editIndex,
            error: `Edit ${editIndex} will fail: string "${edit.old_string}" not found in original file.`,
          };
        }
      }

      if (!edit.replace_all && matches.length > 1) {
        return {
          valid: false,
          failedEditIndex: editIndex,
          error: `Edit ${editIndex} will fail: String "${edit.old_string}" appears ${matches.length} times. Use replace_all=true or provide more context.`,
        };
      }

      // Apply the edit to the simulated content
      simulatedContent = executeFindAndReplace(
        simulatedContent,
        edit.old_string,
        edit.new_string,
        edit.replace_all ?? false,
        editIndex,
        filename,
      );
    } catch (error) {
      return {
        valid: false,
        failedEditIndex: editIndex,
        error: `Edit ${editIndex} validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  return { valid: true };
}

export function executeMultiFindAndReplace(
  fileContent: string,
  edits: EditOperation[],
  filename?: string,
): string {
  // CRITICAL FIX: Validate all edits before applying any
  // This prevents partial application when later edits would fail
  const validation = validateEditChain(fileContent, edits, filename);

  if (!validation.valid) {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceEditChainInvalid,
      validation.error ??
        `Edit chain validation failed at edit ${validation.failedEditIndex}`,
    );
  }

  let result = fileContent;

  // Apply edits in sequence (we know they will all succeed)
  for (let editIndex = 0; editIndex < edits.length; editIndex++) {
    const edit = edits[editIndex];
    result = executeFindAndReplace(
      result,
      edit.old_string,
      edit.new_string,
      edit.replace_all ?? false,
      editIndex,
      filename,
    );
  }

  return result;
}
