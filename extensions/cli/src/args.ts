import * as fs from "fs";
import * as path from "path";

import JSZip from "jszip";

import { env } from "./env.js";

export interface CommandLineArgs {
  configPath?: string;
  organizationSlug?: string; // Organization slug to use for this session
  prompt?: string; // Optional prompt argument
  resume?: boolean; // Resume from last session
  readonly?: boolean; // Start in plan mode (backward compatibility)
  rules?: string[]; // Array of rule specifications
  prompts?: string[]; // Array of prompt specifications
  format?: "json"; // Output format for headless mode
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
 * Load rule content from hub.continue.dev
 * @param slug - The slug in format "owner/package"
 * @returns The rule content from the hub
 */
async function loadRuleFromHub(slug: string): Promise<string> {
  const parts = slug.split("/");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid hub slug format. Expected "owner/package", got: ${slug}`,
    );
  }

  const [ownerSlug, ruleSlug] = parts;
  const downloadUrl = new URL(
    `v0/${ownerSlug}/${ruleSlug}/latest/download`,
    env.apiBase,
  );

  try {
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // The API returns a zip file, so we need to extract the rule content
    const arrayBuffer = await response.arrayBuffer();
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(arrayBuffer);

    // Find the first .md or .txt file (rule content)
    const ruleFiles = Object.keys(zipContents.files).filter(
      (filename) =>
        filename.endsWith(".md") && !zipContents.files[filename].dir,
    );

    if (ruleFiles.length === 0) {
      throw new Error("No rule content found in downloaded zip file");
    }

    // Use the first rule file found - TODO support multiple rules and parse frontmatter
    const ruleFile = zipContents.files[ruleFiles[0]];
    const content = await ruleFile.async("text");
    return content;
  } catch (error: any) {
    throw new Error(`Failed to load rule from hub "${slug}": ${error.message}`);
  }
}

/**
 * Process a specification (rule or prompt) and return its content
 * @param spec - Can be a file path, hub slug, or direct string content
 * @returns The processed content
 */
export async function processPromptOrRule(spec: string): Promise<string> {
  // If it looks like a hub slug (contains / but doesn't start with . or /)
  if (
    spec.includes("/") &&
    !spec.startsWith(".") &&
    !spec.startsWith("/")
  ) {
    return await loadRuleFromHub(spec);
  }

  // If it looks like a file path (contains . or / or ends with common file extensions)
  if (
    spec.includes(".") ||
    spec.includes("/") ||
    spec.includes("\\")
  ) {
    return loadRuleFromFile(spec);
  }

  // Otherwise, treat it as direct string content
  return spec;
}

/**
 * Parse command line arguments for non-permission related flags
 * @deprecated Most functionality has been moved to services. This is only kept for backward compatibility.
 * @returns Parsed command line arguments
 */
/* eslint-disable */
export function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);

  // Default values
  const result: CommandLineArgs = {};

  if (args.includes("--resume")) {
    result.resume = true;
  }

  if (args.includes("--readonly")) {
    result.readonly = true;
  }

  // Get format from --format flag
  const formatIndex = args.indexOf("--format");
  if (formatIndex !== -1 && formatIndex + 1 < args.length) {
    const formatValue = args[formatIndex + 1];
    if (formatValue === "json") {
      result.format = "json";
    }
  }

  // Get config path from --config flag
  const configIndex = args.indexOf("--config");
  if (configIndex !== -1 && configIndex + 1 < args.length) {
    result.configPath = args[configIndex + 1];
  }

  // Get organization slug from --org flag
  const orgIndex = args.indexOf("--org");
  if (orgIndex !== -1 && orgIndex + 1 < args.length) {
    const orgValue = args[orgIndex + 1];
    // Convert "personal" to undefined right away to simplify downstream logic
    result.organizationSlug =
      orgValue.toLowerCase() === "personal" ? undefined : orgValue;
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

  // Get prompts from --prompt flags (can be specified multiple times)
  const promptIndices: number[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prompt") {
      promptIndices.push(i);
    }
  }

  if (promptIndices.length > 0) {
    result.prompts = [];
    for (const promptIndex of promptIndices) {
      if (promptIndex + 1 < args.length) {
        result.prompts.push(args[promptIndex + 1]);
      }
    }
  }

  // Find the last argument that's not a flag or a flag value
  const flagsWithValues = ["--config", "--org", "--rule", "--prompt", "--format"];
  const nonFlagArgs = args.filter((arg, index) => {
    // Skip flags (starting with --)
    if (arg.startsWith("--") || arg === "-p") return false;

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
