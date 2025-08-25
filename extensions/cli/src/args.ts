export interface CommandLineArgs {
  configPath?: string;
  organizationSlug?: string; // Organization slug to use for this session
  prompt?: string; // Optional prompt argument
  resume?: boolean; // Resume from last session
  readonly?: boolean; // Start in plan mode (backward compatibility)
  rules?: string[]; // Array of rule specifications
  mcps?: string[]; // Array of MCP server slugs from the hub
  models?: string[]; // Array of model slugs from the hub
  prompts?: string[]; // Array of prompt slugs from the hub
  format?: "json"; // Output format for headless mode
}

// Re-export hub loader functions for backward compatibility
export { loadMcpFromHub, processRule } from "./hubLoader.js";
// Alias processRule as processPromptOrRule for backward compatibility
export { processRule as processPromptOrRule } from "./hubLoader.js";

/**
 * Extract values for a specific flag that can appear multiple times
 */
function extractMultipleFlags(args: string[], flagName: string): string[] {
  const indices: number[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flagName) {
      indices.push(i);
    }
  }

  const values: string[] = [];
  for (const index of indices) {
    if (index + 1 < args.length && !args[index + 1].startsWith("--")) {
      values.push(args[index + 1]);
    }
  }
  return values;
}

/**
 * Extract value for a single-value flag
 */
function extractSingleFlag(
  args: string[],
  flagName: string,
): string | undefined {
  const index = args.indexOf(flagName);
  if (
    index !== -1 &&
    index + 1 < args.length &&
    !args[index + 1].startsWith("--")
  ) {
    return args[index + 1];
  }
  return undefined;
}

/**
 * Parse command line arguments for non-permission related flags
 * @deprecated Most functionality has been moved to services. This is only kept for backward compatibility.
 * @returns Parsed command line arguments
 */
export function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);
  const result: CommandLineArgs = {};

  // Parse boolean flags
  if (args.includes("--resume")) {
    result.resume = true;
  }
  if (args.includes("--readonly")) {
    result.readonly = true;
  }

  // Parse single-value flags
  const formatValue = extractSingleFlag(args, "--format");
  if (formatValue === "json") {
    result.format = "json";
  }

  result.configPath = extractSingleFlag(args, "--config");

  const orgValue = extractSingleFlag(args, "--org");
  if (orgValue) {
    result.organizationSlug =
      orgValue.toLowerCase() === "personal" ? undefined : orgValue;
  }

  // Parse multi-value flags
  const rules = extractMultipleFlags(args, "--rule");
  if (rules.length > 0) {
    result.rules = rules;
  } else if (args.includes("--rule")) {
    result.rules = [];
  }

  const mcps = extractMultipleFlags(args, "--mcp");
  if (mcps.length > 0) {
    result.mcps = mcps;
  } else if (args.includes("--mcp")) {
    // Ensure we have an empty array if --mcp flag is present but has no values
    result.mcps = [];
  }

  const models = extractMultipleFlags(args, "--model");
  if (models.length > 0) {
    result.models = models;
  } else if (args.includes("--model")) {
    result.models = [];
  }

  const prompts = extractMultipleFlags(args, "--prompt");
  if (prompts.length > 0) {
    result.prompts = prompts;
  } else if (args.includes("--prompt")) {
    result.prompts = [];
  }

  // Extract prompt from non-flag arguments
  const flagsWithValues = [
    "--config",
    "--org",
    "--rule",
    "--mcp",
    "--model",
    "--prompt",
    "--format",
  ];
  const nonFlagArgs = args.filter((arg, index) => {
    if (arg.startsWith("--") || arg === "-p") return false;
    const prevArg = index > 0 ? args[index - 1] : "";
    return !flagsWithValues.includes(prevArg);
  });

  if (nonFlagArgs.length > 0) {
    result.prompt = nonFlagArgs[nonFlagArgs.length - 1];
  }

  return result;
}
