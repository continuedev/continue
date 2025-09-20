import { EditOperation } from "../../tools/definitions/multiEdit";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { findSearchMatches } from "./findSearchMatch";

export function executeFindAndReplace(
  fileContent: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
  editIndex = 0,
): string {
  const matches = findSearchMatches(fileContent, oldString);

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

export function executeMultiFindAndReplace(
  fileContent: string,
  edits: EditOperation[],
): string {
  let result = fileContent;

  // Apply edits in sequence
  for (let editIndex = 0; editIndex < edits.length; editIndex++) {
    const edit = edits[editIndex];
    result = executeFindAndReplace(
      result,
      edit.old_string,
      edit.new_string,
      edit.replace_all ?? false,
      editIndex,
    );
  }

  return result;
}
