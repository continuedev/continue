import { EditOperation } from "../../tools/definitions/multiEdit";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { findSearchMatch, findSearchMatches } from "./findSearchMatch";

export function executeFindAndReplace(
  fileContent: string,
  oldString: string,
  newString: string,
  editIndex = 0,
): string {
  const match = findSearchMatch(fileContent, oldString);
  if (!match) {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceOldStringNotFound,
      `Edit at index ${editIndex}: string not found in file: "${oldString}"`,
    );
  }
  return (
    fileContent.substring(0, match.startIndex) +
    newString +
    fileContent.substring(match.endIndex)
  );
}

export function executeMultiFindAndReplace(
  fileContent: string,
  edits: EditOperation[],
): string {
  let result = fileContent;

  // Apply edits in reverse order by startIndex to avoid position shifts
  // affecting subsequent edits
  for (let editIndex = 0; editIndex < edits.length; editIndex++) {
    const edit = edits[editIndex];
    const matches = findSearchMatches(result, edit.old_string);
    if (matches.length === 0) {
      throw new ContinueError(
        ContinueErrorReason.FindAndReplaceOldStringNotFound,
        `Edit at index ${editIndex}: string not found in file: "${edit.old_string}"`,
      );
    }
    if (edit.replace_all) {
      // Apply replacements in reverse order to maintain correct positions
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        result =
          result.substring(0, match.startIndex) +
          edit.new_string +
          result.substring(match.endIndex);
      }
    } else {
      // For single replacement, check for multiple matches first
      if (matches.length > 1) {
        throw new ContinueError(
          ContinueErrorReason.FindAndReplaceMultipleOccurrences,
          `Edit at index ${editIndex}: String "${edit.old_string}" appears ${matches.length} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`,
        );
      }

      // Apply single replacement
      const match = matches[0];
      result =
        result.substring(0, match.startIndex) +
        edit.new_string +
        result.substring(match.endIndex);
    }
  }

  return result;
}
