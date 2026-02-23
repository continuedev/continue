/**
 * Centralized command line flag validation
 * Provides consistent validation across all commands and proper error reporting
 */

import { safeStderr } from "../init.js";

export interface ValidationOptions {
  // Root command specific flags
  print?: boolean;
  format?: string;
  silent?: boolean;

  // Common flags
  readonly?: boolean;
  auto?: boolean;
  config?: string;

  // Session flags
  resume?: boolean;
  fork?: string;

  // Permission flags
  allow?: string[];
  ask?: string[];
  exclude?: string[];

  // Command context
  isRootCommand?: boolean;
  commandName?: string;
}

export interface ValidationError {
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate that --format flag only works with -p/--print
 */
function validateFormatFlag(options: ValidationOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  if (options.format && !options.print) {
    errors.push({
      code: "FORMAT_REQUIRES_PRINT",
      message: "Error: --format flag can only be used with -p/--print flag",
    });
  }

  return errors;
}

/**
 * Validate that --silent flag only works with -p/--print
 */
function validateSilentFlag(options: ValidationOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  if (options.silent && !options.print) {
    errors.push({
      code: "SILENT_REQUIRES_PRINT",
      message: "Error: --silent flag can only be used with -p/--print flag",
    });
  }

  return errors;
}

/**
 * Validate format value is supported
 */
function validateFormatValue(options: ValidationOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  if (options.format && options.format !== "json") {
    errors.push({
      code: "INVALID_FORMAT_VALUE",
      message: "Error: --format currently only supports 'json'",
    });
  }

  return errors;
}

/**
 * Validate that --readonly and --auto are mutually exclusive
 * This validation is now handled in flagProcessor.ts, but we keep it here for completeness
 */
function validateModeFlags(options: ValidationOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  if (options.readonly && options.auto) {
    errors.push({
      code: "CONFLICTING_MODE_FLAGS",
      message: "Error: Cannot use both --readonly and --auto flags together",
    });
  }

  return errors;
}

/**
 * Validate session flags
 */
function validateSessionFlags(options: ValidationOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  if (options.resume && options.fork) {
    errors.push({
      code: "CONFLICTING_SESSION_FLAGS",
      message: "Error: Cannot use both --resume and --fork flags together",
    });
  }

  if (options.fork !== undefined && (!options.fork || !options.fork.trim())) {
    errors.push({
      code: "FORK_REQUIRES_SESSION_ID",
      message: "Error: --fork requires a session ID (e.g., --fork abc123)",
    });
  }

  return errors;
}

/**
 * Validate config path exists (basic check)
 */
function validateConfigPath(options: ValidationOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  // Note: We don't check file existence here since the config loader handles that
  // and provides better error messages. This is just for basic validation.
  if (options.config && typeof options.config !== "string") {
    errors.push({
      code: "INVALID_CONFIG_PATH",
      message: "Error: --config must be a valid path",
    });
  }

  return errors;
}

/**
 * Validate permission flag combinations
 */
function validatePermissionFlags(
  options: ValidationOptions,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for empty permission arrays (likely user error)
  if (options.allow?.some((tool) => !tool.trim())) {
    errors.push({
      code: "EMPTY_ALLOW_TOOL",
      message: "Error: --allow requires a tool name (e.g., --allow readFile)",
    });
  }

  if (options.ask?.some((tool) => !tool.trim())) {
    errors.push({
      code: "EMPTY_ASK_TOOL",
      message: "Error: --ask requires a tool name (e.g., --ask writeFile)",
    });
  }

  if (options.exclude?.some((tool) => !tool.trim())) {
    errors.push({
      code: "EMPTY_EXCLUDE_TOOL",
      message: "Error: --exclude requires a tool name (e.g., --exclude Write)",
    });
  }

  return errors;
}

/**
 * Run all validation checks on the provided options
 */
export function validateFlags(options: ValidationOptions): ValidationResult {
  const allErrors: ValidationError[] = [];

  // Run all validation functions
  const validators = [
    validateFormatFlag,
    validateSilentFlag,
    validateFormatValue,
    validateModeFlags,
    validateSessionFlags,
    validateConfigPath,
    validatePermissionFlags,
  ];

  for (const validator of validators) {
    allErrors.push(...validator(options));
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Display validation errors and exit process
 * Provides consistent error formatting across all commands
 */
export function handleValidationErrors(errors: ValidationError[]): never {
  for (const error of errors) {
    safeStderr(error.message + "\n");
  }

  if (errors.length > 1) {
    safeStderr(`\nFound ${errors.length} validation errors.\n`);
  }

  // Use async graceful exit without awaiting (we must satisfy never)
  import("../util/exit.js").then(({ gracefulExit }) => gracefulExit(1));
  throw new Error("Exiting due to validation errors");
}
