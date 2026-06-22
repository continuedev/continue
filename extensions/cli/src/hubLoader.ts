<<<<<<< HEAD
=======
/**
 * Rule/package processing utilities.
 *
 * Hub package loading has been removed. Only local file-based rule
 * processing and string detection remain.
 */

>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import {
  AgentFile,
  ModelConfig,
  parseAgentFile,
} from "@continuedev/config-yaml";
<<<<<<< HEAD
import JSZip from "jszip";

import { getAccessToken, loadAuthConfig } from "./auth/workos.js";
import { env } from "./env.js";
import { logger } from "./util/logger.js";

/**
 * Pattern to match valid hub slugs (owner/package format)
=======

import { logger } from "./util/logger.js";

/**
 * Pattern to match valid hub slugs (owner/package format).
 * Kept so that isStringRule can still detect them (and reject them).
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
 */
export const HUB_SLUG_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/**
<<<<<<< HEAD
 * Hub package type definitions
=======
 * Hub package type definitions (kept for type compatibility)
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
 */
export type HubPackageType = "rule" | "mcp" | "model" | "prompt" | "agentFile";

/**
<<<<<<< HEAD
 * Hub package processor interface
=======
 * Hub package processor interface (kept for type compatibility)
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
 */
export interface HubPackageProcessor<T> {
  type: HubPackageType;
  expectedFileExtensions: string[];
  parseContent(content: string, filename: string): Promise<T> | T;
  validateContent?(content: T): boolean;
}

<<<<<<< HEAD
/**
 * Rule processor - handles text content from .md files
 */
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
export const ruleProcessor: HubPackageProcessor<string> = {
  type: "rule",
  expectedFileExtensions: [".md"],
  parseContent: (content: string) => content,
};

<<<<<<< HEAD
/**
 * MCP processor - handles JSON/YAML configuration files
 */
export const mcpProcessor: HubPackageProcessor<any> = {
  type: "mcp",
  expectedFileExtensions: [".json", ".yaml", ".yml"],
  parseContent: async (content: string, filename: string) => {
    let parsed;
    if (filename.endsWith(".json")) {
      parsed = JSON.parse(content);
    } else {
      const yaml = await import("yaml");
      parsed = yaml.parse(content);
    }

    // If the parsed content has an 'mcpServers' array, extract the first MCP server
    // This handles hub packages that return a full config block
    if (
      parsed.mcpServers &&
      Array.isArray(parsed.mcpServers) &&
      parsed.mcpServers.length > 0
    ) {
      return parsed.mcpServers[0];
    }

    return parsed;
  },
};

/**
 * Model processor - handles JSON/YAML configuration files
 */
export const modelProcessor: HubPackageProcessor<ModelConfig> = {
  type: "model",
  expectedFileExtensions: [".json", ".yaml", ".yml"],
  parseContent: async (content: string, filename: string) => {
    let parsed;
    if (filename.endsWith(".json")) {
      parsed = JSON.parse(content);
    } else {
      const yaml = await import("yaml");
      parsed = yaml.parse(content);
    }

    // If the parsed content has a 'models' array, extract the first model
    // This handles hub packages that return a full config block
    if (
      parsed.models &&
      Array.isArray(parsed.models) &&
      parsed.models.length > 0
    ) {
      return parsed.models[0];
    }

    return parsed;
  },
};

/**
 * Prompt processor - handles text content from .md files
 */
export const promptProcessor: HubPackageProcessor<string> = {
  type: "prompt",
  expectedFileExtensions: [".md", ".txt"],
  parseContent: (content: string) => content,
};

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
export const agentFileProcessor: HubPackageProcessor<AgentFile> = {
  type: "agentFile",
  expectedFileExtensions: [".md"],
  parseContent: (content: string) => parseAgentFile(content),
<<<<<<< HEAD
  validateContent: (agentFile: AgentFile) => {
    return !!agentFile.name;
  },
};

/**
 * Generic hub package loader
 * Automatically includes authentication headers when user is logged in,
 * enabling access to private packages.
 */
export async function loadPackageFromHub<T>(
  slug: string,
  processor: HubPackageProcessor<T>,
): Promise<T> {
  const parts = slug.split("/");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid hub slug format. Expected "owner/package", got: ${slug}`,
    );
  }

  const [ownerSlug, packageSlug] = parts;

  // Use different endpoints based on package type
  let downloadUrl: URL;
  if (processor.type === "mcp" || processor.type === "model") {
    // MCP and models use the registry endpoint
    downloadUrl = new URL(
      `registry/v1/${ownerSlug}/${packageSlug}/latest`,
      env.apiBase,
    );
  } else {
    // Rules and prompts use the v0 endpoint
    downloadUrl = new URL(
      `v0/${ownerSlug}/${packageSlug}/latest/download`,
      env.apiBase,
    );
  }

  try {
    // Load auth config and get access token for private package access
    const authConfig = loadAuthConfig();
    const accessToken = getAccessToken(authConfig);

    // Prepare headers with optional authorization
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(downloadUrl, { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check if this is a registry endpoint (returns JSON directly) or a zip file
    if (processor.type === "mcp" || processor.type === "model") {
      // Registry endpoints return JSON with a 'content' field containing YAML/JSON
      const jsonResponse = await response.json();

      // Extract and parse the content field
      if (jsonResponse.content) {
        // Parse the YAML/JSON content
        const parsedContent = await processor.parseContent(
          jsonResponse.content,
          `${slug}.yaml`,
        );
        return parsedContent;
      } else {
        // If there's no content field, return the response as-is (backward compatibility)
        return jsonResponse;
      }
    } else {
      // v0 endpoints return zip files
      const arrayBuffer = await response.arrayBuffer();
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(arrayBuffer);

      // Find files matching expected extensions
      const matchingFiles = Object.keys(zipContents.files).filter(
        (filename) => {
          if (zipContents.files[filename].dir) return false;
          return processor.expectedFileExtensions.some((ext) =>
            filename.endsWith(ext),
          );
        },
      );

      if (matchingFiles.length === 0) {
        throw new Error(
          `No ${processor.type} content found in downloaded zip file. Expected files with extensions: ${processor.expectedFileExtensions.join(", ")}`,
        );
      }

      // Use the first matching file
      const contentFile = zipContents.files[matchingFiles[0]];
      const rawContent = await contentFile.async("text");

      // Parse content using the processor
      const parsedContent = await processor.parseContent(
        rawContent,
        matchingFiles[0],
      );

      // Validate if processor has validation
      if (
        processor.validateContent &&
        !processor.validateContent(parsedContent)
      ) {
        throw new Error(
          `Invalid ${processor.type} content in ${matchingFiles[0]}`,
        );
      }

      return parsedContent;
    }
  } catch (error: any) {
    throw new Error(
      `Failed to load ${processor.type} from hub "${slug}": ${error.message}`,
    );
  }
}

/**
 * Convenience functions for specific package types
=======
  validateContent: (agentFile: AgentFile) => !!agentFile.name,
};

/**
 * Hub package loading has been removed.
 * This function always throws.
 */
export async function loadPackageFromHub<T>(
  slug: string,
  _processor: HubPackageProcessor<T>,
): Promise<T> {
  throw new Error(
    `Hub package loading has been removed. Cannot load "${slug}" from hub.`,
  );
}

/**
 * Convenience functions (stubs that throw)
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
 */
export const loadRuleFromHub = (slug: string) =>
  loadPackageFromHub(slug, ruleProcessor);

<<<<<<< HEAD
export const loadMcpFromHub = (slug: string) =>
  loadPackageFromHub(slug, mcpProcessor);

export const loadModelFromHub = (slug: string) =>
  loadPackageFromHub(slug, modelProcessor);

/**
 * Process a rule specification - supports file paths, hub slugs, or direct content
=======
export const loadMcpFromHub = (_slug: string): Promise<any> =>
  Promise.reject(new Error("Hub package loading has been removed."));

export const loadModelFromHub = (_slug: string): Promise<ModelConfig> =>
  Promise.reject(new Error("Hub package loading has been removed."));

/**
 * Process a rule specification - supports file paths or direct content.
 * Hub slug resolution has been removed.
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
 */
export async function processRule(ruleSpec: string): Promise<string> {
  const trimmedRuleSpec = ruleSpec.trim();
  const hasNewline = /[\r\n]/.test(ruleSpec);

  // If it looks like a file path (single line, typical path indicators)
  const looksLikePath =
    !hasNewline &&
    (trimmedRuleSpec.startsWith(".") ||
      trimmedRuleSpec.startsWith("/") ||
      trimmedRuleSpec.includes("\\") ||
      /\.[a-zA-Z]+$/.test(trimmedRuleSpec));

  if (looksLikePath) {
    const fs = await import("fs");
    const path = await import("path");

    try {
      const absolutePath = path.resolve(trimmedRuleSpec);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Rule file not found: ${ruleSpec}`);
      }
      return fs.readFileSync(absolutePath, "utf-8");
    } catch (error: any) {
      throw new Error(
        `Failed to read rule file "${ruleSpec}": ${error.message}`,
      );
    }
  }

<<<<<<< HEAD
  // Check if it might be a hub slug (contains "/" and is a single line)
  if (!hasNewline && trimmedRuleSpec.includes("/")) {
    const parts = trimmedRuleSpec.split("/");

    // If it's exactly 2 parts and matches hub slug pattern, treat as hub slug
    if (parts.length === 2 && HUB_SLUG_PATTERN.test(trimmedRuleSpec)) {
      return await loadRuleFromHub(trimmedRuleSpec);
    }

    // If it has more than 2 parts, it's an invalid hub slug
    if (parts.length > 2) {
      throw new Error(
        `Invalid hub slug format. Expected "owner/package", got: ${trimmedRuleSpec}`,
      );
    }
  }

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  // Otherwise, treat it as direct string content
  return ruleSpec;
}

export function isStringRule(rule: string) {
  if (rule.includes(" ") || rule.includes("\n")) {
    return true;
  }
  if (
    ["file:/", ".", "/", "~"].some((prefix) => rule.startsWith(prefix)) ||
    rule.includes("\\")
  ) {
    return false;
  }
  if (HUB_SLUG_PATTERN.test(rule)) {
    return false;
  }
  return true;
}

/**
<<<<<<< HEAD
 * Batch load multiple packages with error handling
=======
 * Batch load (stub - always returns empty)
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
 */
export async function loadPackagesFromHub<T>(
  slugs: string[],
  processor: HubPackageProcessor<T>,
): Promise<T[]> {
  const results: T[] = [];
<<<<<<< HEAD

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  for (const slug of slugs) {
    try {
      const content = await loadPackageFromHub(slug, processor);
      results.push(content);
    } catch (error: any) {
      logger.warn(
        `Failed to load ${processor.type} "${slug}": ${error.message}`,
      );
    }
  }
<<<<<<< HEAD

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  return results;
}
