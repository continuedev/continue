export interface CommandLineArgs {
  isHeadless: boolean;
  configPath?: string;
  prompt?: string; // Optional prompt argument
  resume?: boolean; // Resume from last session
  readonly?: boolean; // Only allow readonly tools
  noTools?: boolean; // Disable all tools
}

/**
 * Parse command line arguments
 * @returns Parsed command line arguments
 */
export function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);

  // Default values
  const result: CommandLineArgs = {
    isHeadless: false,
  };

  // Parse flags
  if (args.includes("--headless")) {
    result.isHeadless = true;
  }

  if (args.includes("--resume")) {
    result.resume = true;
  }

  if (args.includes("--readonly")) {
    result.readonly = true;
  }

  if (args.includes("--no-tools")) {
    result.noTools = true;
  }

  // Get config path from --config flag
  const configIndex = args.indexOf("--config");
  if (configIndex !== -1 && configIndex + 1 < args.length) {
    result.configPath = args[configIndex + 1];
  }

  // Find the last argument that's not a flag or a flag value
  const nonFlagArgs = args.filter((arg, index) => {
    // Skip flags (starting with --)
    if (arg.startsWith("--")) return false;

    // Skip flag values
    const prevArg = index > 0 ? args[index - 1] : "";
    if (prevArg === "--config") return false;

    return true;
  });

  // If there are any non-flag arguments, use the last one as the prompt
  if (nonFlagArgs.length > 0) {
    result.prompt = nonFlagArgs[nonFlagArgs.length - 1];
  }

  return result;
}
