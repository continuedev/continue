import * as fs from "fs";
import * as path from "path";

export interface CommandLineArgs {
  isHeadless: boolean;
  configPath?: string;
  prompt?: string; // Optional prompt argument
  resume?: boolean; // Resume from last session
  readonly?: boolean; // Only allow readonly tools
  noTools?: boolean; // Disable all tools
  rules?: string[]; // Array of rule specifications
}

/**
 * Load rule content from a file path
 * @param filePath - Path to the rule file
 * @returns The content of the rule file
 */
function loadRuleFromFile(filePath: string): string {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Rule file not found: ${filePath}`);
    }
    return fs.readFileSync(absolutePath, "utf-8");
  } catch (error: any) {
    throw new Error(`Failed to read rule file "${filePath}": ${error.message}`);
  }
}

/**
 * Load rule content from hub.continue.dev (not yet implemented)
 * @param slug - The slug in format "owner/package"
 * @returns The rule content from the hub
 */
function loadRuleFromHub(slug: string): string {
  // TODO: Implement hub integration
  throw new Error(`Hub rules not yet supported: ${slug}`);
}

/**
 * Process a rule specification and return its content
 * @param ruleSpec - Can be a file path, hub slug, or direct string content
 * @returns The processed rule content
 */
export function processRule(ruleSpec: string): string {
  // If it looks like a hub slug (contains / but doesn't start with . or /)
  if (ruleSpec.includes("/") && !ruleSpec.startsWith(".") && !ruleSpec.startsWith("/")) {
    return loadRuleFromHub(ruleSpec);
  }
  
  // If it looks like a file path (contains . or / or ends with common file extensions)
  if (ruleSpec.includes(".") || ruleSpec.includes("/") || ruleSpec.includes("\\")) {
    return loadRuleFromFile(ruleSpec);
  }
  
  // Otherwise, treat it as direct string content
  return ruleSpec;
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

  // Get rules from --rule flags (can be specified multiple times)
  const ruleIndices: number[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--rule") {
      ruleIndices.push(i);
    }
  }

  if (ruleIndices.length > 0) {
    result.rules = [];
    for (const ruleIndex of ruleIndices) {
      if (ruleIndex + 1 < args.length) {
        result.rules.push(args[ruleIndex + 1]);
      }
    }
  }

  // Find the last argument that's not a flag or a flag value
  const flagsWithValues = ["--config", "--rule"];
  const nonFlagArgs = args.filter((arg, index) => {
    // Skip flags (starting with --)
    if (arg.startsWith("--")) return false;

    // Skip flag values
    const prevArg = index > 0 ? args[index - 1] : "";
    if (flagsWithValues.includes(prevArg)) return false;

    return true;
  });

  // If there are any non-flag arguments, use the last one as the prompt
  if (nonFlagArgs.length > 0) {
    result.prompt = nonFlagArgs[nonFlagArgs.length - 1];
  }

  return result;
}