/**
 * Rule/package processing utilities.
 *
 * Hub package loading has been removed. Only local file-based rule
 * processing and string detection remain.
 */

import {
  AgentFile,
  ModelConfig,
  parseAgentFile,
} from "@continuedev/config-yaml";

import { logger } from "./util/logger.js";

/**
 * Pattern to match valid hub slugs (owner/package format).
 * Kept so that isStringRule can still detect them (and reject them).
 */
export const HUB_SLUG_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/**
 * Hub package type definitions (kept for type compatibility)
 */
export type HubPackageType = "rule" | "mcp" | "model" | "prompt" | "agentFile";

/**
 * Hub package processor interface (kept for type compatibility)
 */
export interface HubPackageProcessor<T> {
  type: HubPackageType;
  expectedFileExtensions: string[];
  parseContent(content: string, filename: string): Promise<T> | T;
  validateContent?(content: T): boolean;
}

export const ruleProcessor: HubPackageProcessor<string> = {
  type: "rule",
  expectedFileExtensions: [".md"],
  parseContent: (content: string) => content,
};

export const agentFileProcessor: HubPackageProcessor<AgentFile> = {
  type: "agentFile",
  expectedFileExtensions: [".md"],
  parseContent: (content: string) => parseAgentFile(content),
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
 */
export const loadRuleFromHub = (slug: string) =>
  loadPackageFromHub(slug, ruleProcessor);

export const loadMcpFromHub = (_slug: string): Promise<any> =>
  Promise.reject(new Error("Hub package loading has been removed."));

export const loadModelFromHub = (_slug: string): Promise<ModelConfig> =>
  Promise.reject(new Error("Hub package loading has been removed."));

/**
 * Process a rule specification - supports file paths or direct content.
 * Hub slug resolution has been removed.
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
 * Batch load (stub - always returns empty)
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
      logger.warn(
        `Failed to load ${processor.type} "${slug}": ${error.message}`,
      );
    }
  }
  return results;
}
