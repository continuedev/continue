import * as path from "path";
import * as os from "os";

export interface CommandLineArgs {
  isHeadless: boolean;
  assistantPath: string;
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
    assistantPath: path.join(os.homedir(), ".continue", "config.yaml")
  };

  // Parse flags
  if (args.includes("--headless")) {
    result.isHeadless = true;
  }

  // Get assistant path or slug (first non-flag argument)
  const nonFlagArgs = args.filter(arg => !arg.startsWith("--"));
  if (nonFlagArgs.length > 0) {
    result.assistantPath = nonFlagArgs[0];
  }

  return result;
}