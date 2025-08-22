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
  const errorContext = index !== undefined ? `Edit #${index + 1}: ` : "";
  // Check if old_string exists in current content
  if (!content.includes(oldString)) {
    throw new Error(`${errorContext}String not found in file: "${oldString}"`);
  }

  if (replaceAll) {
    // Replace all occurrences using replaceAll for proper handling of special characters
    return content.replaceAll(oldString, newString);
  } else {
    // Count occurrences using indexOf for proper handling of special characters
    let count = 0;
    let index = content.indexOf(oldString);
    while (index !== -1) {
      count++;
      index = content.indexOf(oldString, index + 1);
    }

    if (count > 1) {
      throw new Error(
        `${errorContext}String "${oldString}" appears ${count} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`,
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
  const context = index !== undefined ? `Edit #${index + 1}: ` : "";

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
