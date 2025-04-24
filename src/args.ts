import * as os from "os";
import * as path from "path";

export interface CommandLineArgs {
  isHeadless: boolean;
  assistantPath: string;
  prompt?: string; // Optional prompt argument
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
    assistantPath: path.join(os.homedir(), ".continue", "config.yaml"),
  };

  // Parse flags
  if (args.includes("--headless")) {
    result.isHeadless = true;
  }

  // Get assistant path from --assistant flag
  const assistantIndex = args.indexOf("--assistant");
  if (assistantIndex !== -1 && assistantIndex + 1 < args.length) {
    result.assistantPath = args[assistantIndex + 1];
  }

  // Find the last argument that's not a flag or a flag value
  const nonFlagArgs = args.filter((arg, index) => {
    // Skip flags (starting with --)
    if (arg.startsWith("--")) return false;

    // Skip flag values
    const prevArg = index > 0 ? args[index - 1] : "";
    if (prevArg === "--assistant") return false;

    return true;
  });

  // If there are any non-flag arguments, use the last one as the prompt
  if (nonFlagArgs.length > 0) {
    result.prompt = nonFlagArgs[nonFlagArgs.length - 1];
  }

  return result;
}
