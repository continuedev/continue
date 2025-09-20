import { ContinueError, ContinueErrorReason } from "../../util/errors";

export const FOUND_MULTIPLE_FIND_STRINGS_ERROR =
  "Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.";

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
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceMissingOldString,
      `${context}old_string is required`,
    );
  }
  if (newString === undefined) {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceMissingNewString,
      `${context}new_string is required`,
    );
  }
  if (oldString === newString) {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
      `${context}old_string and new_string must be different`,
    );
  }
}

export function trimEmptyLines({
  lines,
  fromEnd,
}: {
  lines: string[];
  fromEnd: boolean;
}): string[] {
  lines = fromEnd ? lines.slice().reverse() : lines.slice();
  const newLines: string[] = [];
  let shouldContinueRemoving = true;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (shouldContinueRemoving && line.trim() === "") continue;
    shouldContinueRemoving = false;
    newLines.push(line);
  }
  return fromEnd ? newLines.reverse() : newLines;
}
