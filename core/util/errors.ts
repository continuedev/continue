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
  FindAndReplaceInvalidReplaceAll = "find_and_replace_invalid_replace_all",
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
  FileTooLarge = "file_too_large",
  PathResolutionFailed = "path_resolution_failed",
  InvalidLineNumber = "invalid_line_number",
  DirectoryNotFound = "directory_not_found",

  // Terminal/Command execution
  CommandExecutionFailed = "command_execution_failed",
  CommandNotAvailableInRemote = "command_not_available_in_remote",

  // Search
  SearchExecutionFailed = "search_execution_failed",

  // Rules
  RuleNotFound = "rule_not_found",

  // Skills
  SkillNotFound = "skill_not_found",

  // Other
  Unspecified = "unspecified", // I.e. a known error but no specific code for it
  Unknown = "unknown", // I.e. an unexpected error
}

export class AbortError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "AbortError";
  }
}

/**
 * Error with a message that is explicitly verified as telemetry-safe.
 */
export class TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS extends Error {
  readonly telemetryMessage: string;

  constructor(message: string, telemetryMessage?: string) {
    super(message);
    this.name = "TelemetrySafeError";
    this.telemetryMessage = telemetryMessage ?? message;
  }
}

export function hasExactErrorMessage(error: unknown, message: string): boolean {
  return error instanceof Error && error.message === message;
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getErrnoCode(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function getErrnoPath(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "path" in error &&
    typeof (error as { path?: unknown }).path === "string"
  ) {
    return (error as { path: string }).path;
  }
  return undefined;
}

export function isENOENT(error: unknown): boolean {
  return getErrnoCode(error) === "ENOENT";
}

export function isFsInaccessible(
  error: unknown,
): error is NodeJS.ErrnoException {
  const code = getErrnoCode(error);
  return (
    code === "ENOENT" ||
    code === "EACCES" ||
    code === "EPERM" ||
    code === "ENOTDIR" ||
    code === "ELOOP"
  );
}

export function shortErrorStack(error: unknown, maxFrames = 5): string {
  if (!(error instanceof Error)) return String(error);
  if (!error.stack) return error.message;

  const lines = error.stack.split("\n");
  const header = lines[0] ?? error.message;
  const frames = lines.slice(1).filter((line) => line.trim().startsWith("at "));
  if (frames.length <= maxFrames) return error.stack;
  return [header, ...frames.slice(0, maxFrames)].join("\n");
}

export type AxiosErrorKind = "auth" | "timeout" | "network" | "http" | "other";

export function classifyAxiosError(error: unknown): {
  kind: AxiosErrorKind;
  status?: number;
  message: string;
} {
  const message = errorMessage(error);
  if (
    !error ||
    typeof error !== "object" ||
    !("isAxiosError" in error) ||
    !(error as { isAxiosError?: boolean }).isAxiosError
  ) {
    return { kind: "other", message };
  }

  const axiosError = error as {
    response?: { status?: number };
    code?: string;
  };
  const status = axiosError.response?.status;
  if (status === 401 || status === 403)
    return { kind: "auth", status, message };
  if (axiosError.code === "ECONNABORTED")
    return { kind: "timeout", status, message };
  if (axiosError.code === "ECONNREFUSED" || axiosError.code === "ENOTFOUND") {
    return { kind: "network", status, message };
  }
  return { kind: "http", status, message };
}

export { isAbortError } from "./isAbortError.js";
