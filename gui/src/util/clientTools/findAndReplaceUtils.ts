import { EditOperation } from "core/tools/definitions/multiEdit";

export const FOUND_MULTIPLE_FIND_STRINGS_ERROR =
  "Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.";

/**
 * Performs a find and replace operation on text content with proper handling of special characters
 */
export function performFindAndReplace(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false,
  index?: number, // For error messages
): string {
  const errorContext = index !== undefined ? `edit at index ${index}: ` : "";
  // Check if old_string exists in current content
  if (!content.includes(oldString)) {
    throw new Error(`${errorContext}string not found in file: "${oldString}"`);
  }

  if (replaceAll) {
    // Replace all occurrences using replaceAll for proper handling of special characters
    return content.replaceAll(oldString, newString);
  } else {
    // Handle empty oldString case (insertion)
    if (oldString === "") {
      return newString + content;
    }

    // Count occurrences using indexOf for proper handling of special characters
    let count = 0;
    let searchIndex = content.indexOf(oldString);
    while (searchIndex !== -1) {
      count++;
      searchIndex = content.indexOf(oldString, searchIndex + 1);
    }

    if (count > 1) {
      throw new Error(
        `${errorContext}String "${oldString}" appears ${count} times in the file. ${FOUND_MULTIPLE_FIND_STRINGS_ERROR}`,
      );
    }

    // Replace only the first occurrence
    const firstIndex = content.indexOf(oldString);
    return (
      content.substring(0, firstIndex) +
      newString +
      content.substring(firstIndex + oldString.length)
    );
  }
}

/**
 * Validates a single edit operation
 */
export function validateSingleEdit(
  oldString: string,
  newString: string,
  index?: number,
): void {
  const context = index !== undefined ? `edit at index ${index}: ` : "";

  if (!oldString && oldString !== "") {
    throw new Error(`${context}old_string is required`);
  }
  if (newString === undefined) {
    throw new Error(`${context}new_string is required`);
  }
  if (oldString === newString) {
    throw new Error(`${context}old_string and new_string must be different`);
  }
}

export const EMPTY_NON_FIRST_EDIT_MESSAGE =
  "contains empty old_string. Only the first edit can contain an empty old_string, which is only used for file creation.";
export function validateCreatingForMultiEdit(edits: EditOperation[]) {
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
            `edit at index ${i}: ${EMPTY_NON_FIRST_EDIT_MESSAGE}`,
          );
        }
      }
    }
  }

  return isCreating;
}
