import JSZip from "jszip";

import { env } from "./env.js";
import { logger } from "./util/logger.js";

/**
 * Hub package type definitions
 */
export type HubPackageType = "rule" | "mcp" | "model" | "prompt";

/**
 * Hub package processor interface
 */
export interface HubPackageProcessor<T> {
  type: HubPackageType;
  expectedFileExtensions: string[];
  parseContent(content: string, filename: string): Promise<T> | T;
  validateContent?(content: T): boolean;
}

/**
 * Rule processor - handles text content from .md files
 */
export const ruleProcessor: HubPackageProcessor<string> = {
  type: "rule",
  expectedFileExtensions: [".md"],
  parseContent: (content: string) => content,
};

/**
 * MCP processor - handles JSON/YAML configuration files
 */
export const mcpProcessor: HubPackageProcessor<any> = {
  type: "mcp",
  expectedFileExtensions: [".json", ".yaml", ".yml"],
  parseContent: async (content: string, filename: string) => {
    if (filename.endsWith(".json")) {
      return JSON.parse(content);
    } else {
      const yaml = await import("yaml");
      return yaml.parse(content);
    }
  },
};

/**
 * Model processor - handles JSON/YAML configuration files
 */
export const modelProcessor: HubPackageProcessor<any> = {
  type: "model",
  expectedFileExtensions: [".json", ".yaml", ".yml"],
  parseContent: async (content: string, filename: string) => {
    if (filename.endsWith(".json")) {
      return JSON.parse(content);
    } else {
      const yaml = await import("yaml");
      return yaml.parse(content);
    }
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

/**
 * Generic hub package loader
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
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check if this is a registry endpoint (returns JSON directly) or a zip file
    if (processor.type === "mcp" || processor.type === "model") {
      // Registry endpoints return JSON directly
      const jsonContent = await response.json();
      return jsonContent;
    } else {
      // v0 endpoints return zip files
      const arrayBuffer = await response.arrayBuffer();
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(arrayBuffer);

      // Find files matching expected extensions
      const matchingFiles = Object.keys(zipContents.files).filter((filename) => {
        if (zipContents.files[filename].dir) return false;
        return processor.expectedFileExtensions.some((ext) =>
          filename.endsWith(ext),
        );
      });

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
      if (processor.validateContent && !processor.validateContent(parsedContent)) {
        throw new Error(`Invalid ${processor.type} content in ${matchingFiles[0]}`);
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
 */
export const loadRuleFromHub = (slug: string) =>
  loadPackageFromHub(slug, ruleProcessor);

export const loadMcpFromHub = (slug: string) =>
  loadPackageFromHub(slug, mcpProcessor);

export const loadModelFromHub = (slug: string) =>
  loadPackageFromHub(slug, modelProcessor);

export const loadPromptFromHub = (slug: string) =>
  loadPackageFromHub(slug, promptProcessor);

/**
 * Process a rule specification - supports file paths, hub slugs, or direct content
 */
export async function processRule(ruleSpec: string): Promise<string> {
  // If it looks like a hub slug (contains / but doesn't start with . or /)
  if (
    ruleSpec.includes("/") &&
    !ruleSpec.startsWith(".") &&
    !ruleSpec.startsWith("/")
  ) {
    return await loadRuleFromHub(ruleSpec);
  }

  // If it looks like a file path
  if (
    ruleSpec.includes(".") ||
    ruleSpec.includes("/") ||
    ruleSpec.includes("\\")
  ) {
    const fs = await import("fs");
    const path = await import("path");
    
    try {
      const absolutePath = path.resolve(ruleSpec);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Rule file not found: ${ruleSpec}`);
      }
      return fs.readFileSync(absolutePath, "utf-8");
    } catch (error: any) {
      throw new Error(`Failed to read rule file "${ruleSpec}": ${error.message}`);
    }
  }

  // Otherwise, treat it as direct string content
  return ruleSpec;
}

/**
 * Batch load multiple packages with error handling
 */
export async function loadPackagesFromHub<T>(
  slugs: string[],
  processor: HubPackageProcessor<T>,
): Promise<T[]> {
  const results: T[] = [];

  for (const slug of slugs) {
    try {
      const content = await loadPackageFromHub(slug, processor);
      results.push(content);
    } catch (error: any) {
      logger.warn(`Failed to load ${processor.type} "${slug}": ${error.message}`);
    }
  }

  return results;
}