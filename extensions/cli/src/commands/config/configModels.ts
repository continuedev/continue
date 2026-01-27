/* eslint-disable max-lines */
/**
 * Config Model Management
 *
 * Manages config.yaml models against available provider models.
 * Preserves comments and non-model sections when modifying config.
 *
 * Works with any OpenAI-compatible provider that has a /models endpoint.
 */

import * as fs from "fs";
import * as path from "path";

import { parseDocument, Document } from "yaml";

// Config sections that should NEVER be modified by sync/generate
export const PRESERVED_SECTIONS = [
  "name",
  "version",
  "schema",
  "metadata",
  "env",
  "requestOptions",
  "mcpServers",
  "context",
  "data",
  "rules",
  "prompts",
  "docs",
] as const;

// Section that IS modified by sync/generate
export const MODIFIED_SECTIONS = ["models"] as const;

export interface ModelInfo {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface ModelsResponse {
  data: ModelInfo[];
  object?: string;
}

export interface ConfigModel {
  name?: string;
  provider?: string;
  model: string;
  apiKey?: string;
  apiBase?: string;
  requestOptions?: {
    headers?: Record<string, string>;
  };
  roles?: string[];
  defaultCompletionOptions?: Record<string, unknown>;
}

export interface VerifyResult {
  available: string[];
  unavailable: string[];
  configModels: string[];
}

export interface SyncResult {
  removed: string[];
  kept: string[];
  preservedSections: string[];
}

export interface SectionsResult {
  sections: Record<string, number>;
  metadata: Record<string, string>;
}

export interface ModelCategories {
  chat: string[];
  embed: string[];
  rerank: string[];
}

/**
 * Configuration for the model management commands
 */
export interface ConfigManagerOptions {
  continueHome?: string;
  apiBase?: string;
  apiKeyEnvVar?: string;
  authHeader?: string;
}

/**
 * Get the Continue home directory
 */
export function getContinueHome(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  return (
    process.env.CONTINUE_HOME ||
    path.join(process.env.HOME || process.env.USERPROFILE || "", ".continue")
  );
}

/**
 * Get config file path
 */
export function getConfigPath(continueHome: string): string {
  return path.join(continueHome, "config.yaml");
}

/**
 * Get .env file path
 */
export function getEnvPath(continueHome: string): string {
  return path.join(continueHome, ".env");
}

/**
 * Read API key from .env file
 */
export function readApiKeyFromEnv(
  envPath: string,
  keyName: string = "API_KEY",
): string | null {
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${keyName}=`)) {
      const value = trimmed.slice(keyName.length + 1).trim();
      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        return value.slice(1, -1);
      }
      return value;
    }
  }
  return null;
}

/**
 * Load config.yaml as a YAML Document (preserves comments)
 */
export function loadConfigDocument(configPath: string): Document | null {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, "utf-8");
  return parseDocument(content);
}

/**
 * Load config.yaml as plain object
 */
export function loadConfig(configPath: string): Record<string, unknown> | null {
  const doc = loadConfigDocument(configPath);
  if (!doc) {
    return null;
  }
  return doc.toJSON() as Record<string, unknown>;
}

/**
 * Save config document atomically
 */
export function saveConfigDocument(configPath: string, doc: Document): void {
  const tempPath = configPath + ".tmp";
  fs.writeFileSync(tempPath, doc.toString());
  fs.renameSync(tempPath, configPath);
}

/**
 * Get model IDs from config
 */
export function getConfigModelIds(config: Record<string, unknown>): string[] {
  const models = config.models as ConfigModel[] | undefined;
  if (!models || !Array.isArray(models)) {
    return [];
  }
  return models.map((m) => m.model).filter(Boolean);
}

/**
 * Categorize models into chat, embed, rerank
 */
export function categorizeModels(modelIds: string[]): ModelCategories {
  const categories: ModelCategories = { chat: [], embed: [], rerank: [] };

  for (const m of [...modelIds].sort()) {
    const ml = m.toLowerCase();
    if (
      ml.includes("embed") ||
      (ml.startsWith("baai/bge") && !ml.includes("rerank"))
    ) {
      categories.embed.push(m);
    } else if (ml.includes("rerank")) {
      categories.rerank.push(m);
    } else {
      categories.chat.push(m);
    }
  }

  return categories;
}

/**
 * Query available models from an OpenAI-compatible endpoint
 */
export async function queryModels(
  apiBase: string,
  apiKey: string,
  authHeader: string = "Authorization",
): Promise<string[]> {
  const url = `${apiBase.replace(/\/$/, "")}/models`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Support different auth header styles
  if (authHeader.toLowerCase() === "authorization") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers[authHeader] = apiKey;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to query models: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as ModelsResponse;
  return data.data.map((m) => m.id);
}

/**
 * Test a model with a simple query
 */
export async function testModel(
  apiBase: string,
  apiKey: string,
  modelId: string,
  authHeader: string = "Authorization",
): Promise<{ success: boolean; message: string }> {
  const url = `${apiBase.replace(/\/$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authHeader.toLowerCase() === "authorization") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers[authHeader] = apiKey;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      const errorMessage = errorData?.error?.message || response.statusText;
      return { success: false, message: String(errorMessage).slice(0, 50) };
    }

    const data = await response.json();
    if ((data as Record<string, unknown>).choices) {
      return { success: true, message: "OK" };
    }
    return { success: false, message: "No choices in response" };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message.slice(0, 50) : "Unknown error",
    };
  }
}

/**
 * Validate config structure
 */
export function validateConfigStructure(
  config: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push("Missing required field: name");
  }

  const models = config.models as ConfigModel[] | undefined;
  if (!models || !Array.isArray(models) || models.length === 0) {
    errors.push("No models defined");
    return errors;
  }

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    if (!model || typeof model !== "object") {
      errors.push(`Model ${i}: not a valid object`);
      continue;
    }
    if (!model.model) {
      errors.push(`Model ${i}: missing 'model' field`);
    }
    if (!model.provider) {
      errors.push(`Model ${i}: missing 'provider' field`);
    }
  }

  return errors;
}

/**
 * Get sections info from config
 */
export function getSectionsInfo(
  config: Record<string, unknown>,
): SectionsResult {
  const sections: Record<string, number> = {};
  const metadata: Record<string, string> = {};

  // Count array sections
  for (const key of [
    "models",
    "mcpServers",
    "context",
    "data",
    "rules",
    "prompts",
    "docs",
  ]) {
    const value = config[key];
    if (Array.isArray(value)) {
      sections[key] = value.length;
    } else {
      sections[key] = 0;
    }
  }

  // Get metadata fields
  for (const key of ["name", "version", "schema"]) {
    if (config[key]) {
      metadata[key] = String(config[key]);
    }
  }

  return { sections, metadata };
}

/**
 * Create a backup of the config file
 */
export function backupConfig(configPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = configPath.replace(".yaml", `.backup-${timestamp}.yaml`);
  fs.copyFileSync(configPath, backupPath);
  return backupPath;
}

/**
 * Verify command - Check if config models are available
 */
export async function verifyModels(
  configPath: string,
  apiBase: string,
  apiKey: string,
  authHeader?: string,
): Promise<VerifyResult> {
  const config = loadConfig(configPath);
  if (!config) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const configModels = getConfigModelIds(config);
  const availableModels = new Set(
    await queryModels(apiBase, apiKey, authHeader),
  );

  const available: string[] = [];
  const unavailable: string[] = [];

  for (const model of configModels) {
    if (availableModels.has(model)) {
      available.push(model);
    } else {
      unavailable.push(model);
    }
  }

  return { available, unavailable, configModels };
}

/**
 * Sync command - Remove unavailable models, preserving everything else
 */
export async function syncModels(
  configPath: string,
  apiBase: string,
  apiKey: string,
  authHeader?: string,
  dryRun: boolean = false,
): Promise<SyncResult> {
  const doc = loadConfigDocument(configPath);
  if (!doc) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const config = doc.toJSON() as Record<string, unknown>;
  const availableModels = new Set(
    await queryModels(apiBase, apiKey, authHeader),
  );

  // Track preserved sections
  const preservedSections: string[] = [];
  for (const key of PRESERVED_SECTIONS) {
    if (config[key]) {
      const value = config[key];
      if (Array.isArray(value)) {
        preservedSections.push(`${key}: ${value.length} entries`);
      } else {
        preservedSections.push(key);
      }
    }
  }

  // Find models to keep/remove
  const models = config.models as ConfigModel[] | undefined;
  if (!models || !Array.isArray(models)) {
    return { removed: [], kept: [], preservedSections };
  }

  const kept: string[] = [];
  const removed: string[] = [];

  for (const model of models) {
    if (availableModels.has(model.model)) {
      kept.push(model.model);
    } else {
      removed.push(model.model);
    }
  }

  if (removed.length === 0) {
    return { removed: [], kept, preservedSections };
  }

  if (dryRun) {
    return { removed, kept, preservedSections };
  }

  // Actually perform the sync - only modify the models array
  const newModels = models.filter((m) => availableModels.has(m.model));
  doc.set("models", newModels);

  // Backup and save
  backupConfig(configPath);
  saveConfigDocument(configPath, doc);

  return { removed, kept, preservedSections };
}

/**
 * Create a model entry for config
 */
export function createModelEntry(
  modelId: string,
  apiBase: string,
  apiKeyRef: string,
  authHeader?: string,
  roles?: string[],
): ConfigModel {
  const name = modelId.includes("/") ? modelId.split("/").pop()! : modelId;

  const entry: ConfigModel = {
    name,
    provider: "openai",
    model: modelId,
    apiKey: apiKeyRef,
    apiBase,
  };

  // Add custom auth header if not standard
  if (authHeader && authHeader.toLowerCase() !== "authorization") {
    entry.requestOptions = {
      headers: {
        [authHeader]: apiKeyRef,
      },
    };
  }

  if (roles && roles.length > 0) {
    entry.roles = roles;
  }

  return entry;
}

// ============================================================
// NEW FEATURES
// ============================================================

export interface AddModelResult {
  added: boolean;
  modelId: string;
  name?: string;
  roles?: string[];
  reason?: string;
}

export interface AddModelOptions {
  name?: string;
  roles?: string[];
  authHeader?: string;
  dryRun?: boolean;
}

/**
 * Add a model to config
 */
export async function addModelToConfig(
  configPath: string,
  modelId: string,
  apiBase: string,
  apiKeyRef: string,
  options: AddModelOptions = {},
): Promise<AddModelResult> {
  const doc = loadConfigDocument(configPath);
  if (!doc) {
    return { added: false, modelId, reason: "Config not found" };
  }

  const config = doc.toJSON() as Record<string, unknown>;
  const models = (config.models as ConfigModel[]) || [];

  // Check if model already exists
  if (models.some((m) => m.model === modelId)) {
    return { added: false, modelId, reason: `Model ${modelId} already exists` };
  }

  // Determine roles based on model type if not provided
  let roles = options.roles;
  if (!roles) {
    const categories = categorizeModels([modelId]);
    if (categories.embed.length > 0) {
      roles = ["embed"];
    } else if (categories.rerank.length > 0) {
      roles = ["rerank"];
    } else {
      roles = ["chat"];
    }
  }

  // Create the new model entry
  const entry = createModelEntry(
    modelId,
    apiBase,
    apiKeyRef,
    options.authHeader,
    roles,
  );

  // Override name if provided
  if (options.name) {
    entry.name = options.name;
  }

  if (!options.dryRun) {
    // Add to models array
    models.push(entry);
    doc.set("models", models);

    // Backup and save
    backupConfig(configPath);
    saveConfigDocument(configPath, doc);
  }

  return {
    added: true,
    modelId,
    name: entry.name,
    roles: entry.roles,
  };
}

export interface RemoveModelResult {
  removed: boolean;
  modelId: string;
  reason?: string;
  dryRun?: boolean;
}

export interface RemoveModelOptions {
  dryRun?: boolean;
}

/**
 * Remove a model from config
 */
export async function removeModelFromConfig(
  configPath: string,
  modelId: string,
  options: RemoveModelOptions = {},
): Promise<RemoveModelResult> {
  const doc = loadConfigDocument(configPath);
  if (!doc) {
    return { removed: false, modelId, reason: "Config not found" };
  }

  const config = doc.toJSON() as Record<string, unknown>;
  const models = (config.models as ConfigModel[]) || [];

  // Check if model exists
  const index = models.findIndex((m) => m.model === modelId);
  if (index === -1) {
    return { removed: false, modelId, reason: `Model ${modelId} not found` };
  }

  if (options.dryRun) {
    return { removed: true, modelId, dryRun: true };
  }

  // Remove the model
  models.splice(index, 1);
  doc.set("models", models);

  // Backup and save
  backupConfig(configPath);
  saveConfigDocument(configPath, doc);

  return { removed: true, modelId };
}

export interface GenerateConfigOptions {
  name?: string;
  chatOnly?: boolean;
  embedOnly?: boolean;
  rerankOnly?: boolean;
}

/**
 * Generate a new config from available models
 */
export async function generateConfig(
  availableModels: string[],
  apiBase: string,
  apiKeyRef: string,
  options: GenerateConfigOptions = {},
): Promise<Record<string, unknown>> {
  const categories = categorizeModels(availableModels);

  let modelsToInclude: string[] = [];

  if (options.chatOnly) {
    modelsToInclude = categories.chat;
  } else if (options.embedOnly) {
    modelsToInclude = categories.embed;
  } else if (options.rerankOnly) {
    modelsToInclude = categories.rerank;
  } else {
    // Include all
    modelsToInclude = availableModels;
  }

  // Create model entries with appropriate roles
  const models = modelsToInclude.map((modelId) => {
    let roles: string[];
    if (categories.embed.includes(modelId)) {
      roles = ["embed"];
    } else if (categories.rerank.includes(modelId)) {
      roles = ["rerank"];
    } else {
      roles = ["chat"];
    }

    return createModelEntry(modelId, apiBase, apiKeyRef, undefined, roles);
  });

  return {
    name: options.name || "Generated Config",
    version: "1.0.0",
    models,
  };
}

export interface DiffResult {
  inConfigNotAvailable: string[];
  availableNotInConfig: string[];
  inBoth: string[];
}

/**
 * Diff config models against available models
 */
export function diffModels(
  configModels: string[],
  availableModels: string[],
): DiffResult {
  const configSet = new Set(configModels);
  const availableSet = new Set(availableModels);

  const inConfigNotAvailable: string[] = [];
  const inBoth: string[] = [];

  for (const model of configModels) {
    if (availableSet.has(model)) {
      inBoth.push(model);
    } else {
      inConfigNotAvailable.push(model);
    }
  }

  const availableNotInConfig: string[] = [];
  for (const model of availableModels) {
    if (!configSet.has(model)) {
      availableNotInConfig.push(model);
    }
  }

  return {
    inConfigNotAvailable: inConfigNotAvailable.sort(),
    availableNotInConfig: availableNotInConfig.sort(),
    inBoth: inBoth.sort(),
  };
}

/**
 * List backup files
 */
export function listBackups(continueHome: string): string[] {
  if (!fs.existsSync(continueHome)) {
    return [];
  }

  const files = fs.readdirSync(continueHome) as string[];
  const backups = files
    .filter(
      (f: string) => f.startsWith("config.backup-") && f.endsWith(".yaml"),
    )
    .sort()
    .reverse();

  return backups;
}

export interface RestoreResult {
  restored: boolean;
  reason?: string;
}

/**
 * Restore from a backup file
 */
export function restoreBackup(
  continueHome: string,
  backupFilename: string,
): RestoreResult {
  const backupPath = path.join(continueHome, backupFilename);
  const configPath = getConfigPath(continueHome);

  if (!fs.existsSync(backupPath)) {
    return { restored: false, reason: `Backup file not found: ${backupPath}` };
  }

  // Create backup of current config before restoring
  if (fs.existsSync(configPath)) {
    backupConfig(configPath);
  }

  // Restore
  fs.copyFileSync(backupPath, configPath);

  return { restored: true };
}

export interface ProviderPreset {
  apiBase: string;
  authHeader: string;
  apiKeyEnv: string;
  requiresApiKey?: boolean;
}

/**
 * Get provider preset configuration
 */
export function getProviderPreset(provider: string): ProviderPreset | null {
  const presets: Record<string, ProviderPreset> = {
    openai: {
      apiBase: "https://api.openai.com/v1",
      authHeader: "Authorization",
      apiKeyEnv: "OPENAI_API_KEY",
    },
    anthropic: {
      apiBase: "https://api.anthropic.com/v1",
      authHeader: "x-api-key",
      apiKeyEnv: "ANTHROPIC_API_KEY",
    },
    azure: {
      apiBase: "", // User must provide
      authHeader: "api-key",
      apiKeyEnv: "AZURE_API_KEY",
    },
    ollama: {
      apiBase: "http://localhost:11434/v1",
      authHeader: "Authorization",
      apiKeyEnv: "",
      requiresApiKey: false,
    },
    together: {
      apiBase: "https://api.together.xyz/v1",
      authHeader: "Authorization",
      apiKeyEnv: "TOGETHER_API_KEY",
    },
    groq: {
      apiBase: "https://api.groq.com/openai/v1",
      authHeader: "Authorization",
      apiKeyEnv: "GROQ_API_KEY",
    },
    mistral: {
      apiBase: "https://api.mistral.ai/v1",
      authHeader: "Authorization",
      apiKeyEnv: "MISTRAL_API_KEY",
    },
  };

  return presets[provider.toLowerCase()] || null;
}

export interface FilterOptions {
  pattern?: string;
  chatOnly?: boolean;
  embedOnly?: boolean;
  rerankOnly?: boolean;
}

/**
 * Filter models by pattern and/or type
 */
export function filterModels(
  models: string[],
  options: FilterOptions = {},
): string[] {
  let result = [...models];

  // Apply type filter first
  if (options.chatOnly || options.embedOnly || options.rerankOnly) {
    const categories = categorizeModels(result);
    if (options.chatOnly) {
      result = categories.chat;
    } else if (options.embedOnly) {
      result = categories.embed;
    } else if (options.rerankOnly) {
      result = categories.rerank;
    }
  }

  // Apply pattern filter
  if (options.pattern) {
    const pattern = options.pattern.toLowerCase();
    result = result.filter((m) => m.toLowerCase().includes(pattern));
  }

  return result;
}

/**
 * Format result as JSON for programmatic output
 */
export function formatAsJson(command: string, data: unknown): string {
  return JSON.stringify({ command, data }, null, 2);
}
