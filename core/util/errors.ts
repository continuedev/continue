/**
 * Recursively retrieves the root cause of an error by traversing through its `cause` property.
 *
 * @param err - The error object to analyze. It can be of any type.
 * @returns The root cause of the error, or the original error if no further cause is found.
 */
export function getRootCause(err: any): any {
  if (err.cause) {
    return getRootCause(err.cause);
  }
  return err;
}

export class ContinueError extends Error {
  reason: ContinueErrorReason;

  constructor(reason: ContinueErrorReason, message?: string) {
    super(message);
    this.reason = reason;
    this.name = "ContinueError";
  }
}

export enum ContinueErrorReason {
  // Find and Replace validation errors
  FindAndReplaceIdenticalOldAndNewStrings = "find_and_replace_identical_old_and_new_strings",
  FindAndReplaceMissingOldString = "find_and_replace_missing_old_string",
  FindAndReplaceNonFirstEmptyOldString = "find_and_replace_non_first_empty_old_string",
  FindAndReplaceMissingNewString = "find_and_replace_missing_new_string",
  FindAndReplaceOldStringNotFound = "find_and_replace_old_string_not_found",
  FindAndReplaceMultipleOccurrences = "find_and_replace_multiple_occurrences",
  FindAndReplaceMissingFilepath = "find_and_replace_missing_filepath",

  // Multi-edit
  MultiEditEditsArrayRequired = "multi_edit_edits_array_required",
  MultiEditEditsArrayEmpty = "multi_edit_edits_array_empty",
  MultiEditSubsequentEditsOnCreation = "multi_edit_subsequent_edits_on_creation",
  MultiEditEmptyOldStringNotFirst = "multi_edit_empty_old_string_not_first",

  // General Edit
  EditToolFileNotRead = "edit_tool_file_not_yet_read",

  // General File
  FileAlreadyExists = "file_already_exists",
  FileNotFound = "file_not_found",
  FileWriteError = "file_write_error",
  FileIsSecurityConcern = "file_is_security_concern",
  ParentDirectoryNotFound = "parent_directory_not_found",

  // Other
  Unspecified = "unspecified",
  Unknown = "unknown",
}
