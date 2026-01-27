/* eslint-disable max-lines */
/**
 * Config Command
 *
 * Provides subcommands for managing config.yaml:
 * - cn config verify   - Check if models are available
 * - cn config sync     - Remove unavailable models
 * - cn config sections - Show what sections exist
 * - cn config validate - Validate config structure
 */

import { Command } from "commander";

import {
  addModelToConfig,
  categorizeModels,
  diffModels,
  filterModels,
  formatAsJson,
  generateConfig,
  getConfigModelIds,
  getConfigPath,
  getContinueHome,
  getEnvPath,
  getProviderPreset,
  getSectionsInfo,
  listBackups,
  loadConfig,
  PRESERVED_SECTIONS,
  queryModels,
  readApiKeyFromEnv,
  removeModelFromConfig,
  restoreBackup,
  syncModels,
  testModel,
  validateConfigStructure,
  verifyModels,
} from "./configModels.js";

interface ConfigCommandOptions {
  apiBase?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  authHeader?: string;
  dryRun?: boolean;
  continueHome?: string;
  json?: boolean;
  provider?: string;
  chatOnly?: boolean;
  embedOnly?: boolean;
  rerankOnly?: boolean;
  filter?: string;
  name?: string;
  role?: string[];
}

/**
 * Get API configuration from options, environment, or .env file
 */
// eslint-disable-next-line complexity
function getApiConfig(
  options: ConfigCommandOptions,
  requireApiKey: boolean = true,
): {
  apiBase: string;
  apiKey: string;
  authHeader: string;
} {
  const continueHome = getContinueHome(options.continueHome);
  const envPath = getEnvPath(continueHome);

  // Check for provider preset first
  const preset = options.provider ? getProviderPreset(options.provider) : null;

  // API base
  const apiBase =
    options.apiBase ||
    preset?.apiBase ||
    process.env.CONTINUE_API_BASE ||
    readApiKeyFromEnv(envPath, "API_BASE") ||
    "https://api.openai.com/v1";

  // Auth header (from preset or option)
  const authHeader =
    options.authHeader || preset?.authHeader || "Authorization";

  // API key - check options, env var specified, preset env var, process.env, .env file
  let apiKey: string | undefined = options.apiKey;

  if (!apiKey && options.apiKeyEnv) {
    apiKey =
      process.env[options.apiKeyEnv] ??
      readApiKeyFromEnv(envPath, options.apiKeyEnv) ??
      undefined;
  }
  if (!apiKey && preset?.apiKeyEnv) {
    apiKey =
      process.env[preset.apiKeyEnv] ??
      readApiKeyFromEnv(envPath, preset.apiKeyEnv) ??
      undefined;
  }
  if (!apiKey) {
    apiKey =
      process.env.OPENAI_API_KEY ??
      readApiKeyFromEnv(envPath, "OPENAI_API_KEY") ??
      undefined;
  }
  if (!apiKey) {
    apiKey = readApiKeyFromEnv(envPath, "API_KEY") ?? undefined;
  }

  // Some providers (like Ollama) don't require an API key
  if (!apiKey && requireApiKey && preset?.requiresApiKey !== false) {
    throw new Error(
      "No API key found. Set OPENAI_API_KEY environment variable, " +
        "add it to ~/.continue/.env, or use --api-key flag.",
    );
  }

  return { apiBase, apiKey: apiKey || "", authHeader };
}

/**
 * Verify command - Check if config models are available
 */
async function runVerify(options: ConfigCommandOptions): Promise<void> {
  console.log("Verifying config against available models...\n");

  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  try {
    const { apiBase, apiKey, authHeader } = getApiConfig(options);
    const result = await verifyModels(configPath, apiBase, apiKey, authHeader);

    console.log("Config Models:\n");
    for (const model of result.available) {
      console.log(`  ✓ ${model}`);
    }
    for (const model of result.unavailable) {
      console.log(`  ✗ ${model} (NOT AVAILABLE)`);
    }

    console.log();
    if (result.unavailable.length === 0) {
      console.log("All config models are available!");
    } else {
      console.log(`${result.unavailable.length} model(s) not available.`);
      console.log("Run 'cn config sync' to remove them.");
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Sync command - Remove unavailable models
 */
async function runSync(options: ConfigCommandOptions): Promise<void> {
  const prefix = options.dryRun ? "DRY RUN - " : "";
  console.log(`${prefix}Syncing config with available models...\n`);

  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  try {
    const { apiBase, apiKey, authHeader } = getApiConfig(options);
    const result = await syncModels(
      configPath,
      apiBase,
      apiKey,
      authHeader,
      options.dryRun,
    );

    console.log("Preserved sections:");
    for (const section of result.preservedSections) {
      console.log(`  ✓ ${section}`);
    }

    if (result.removed.length === 0) {
      console.log("\nNo changes needed - all models are available.");
      return;
    }

    console.log(`\nModels to remove (${result.removed.length}):`);
    for (const model of result.removed) {
      console.log(`  - ${model}`);
    }

    console.log(`\nModels to keep (${result.kept.length}):`);
    for (const model of result.kept) {
      console.log(`  ✓ ${model}`);
    }

    if (options.dryRun) {
      console.log("\n--- DRY RUN (no changes made) ---");
    } else {
      console.log(`\nRemoved ${result.removed.length} unavailable model(s).`);
    }
  } catch (error) {
    console.error(
      `ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Sections command - Show what sections exist in config
 */
async function runSections(options: ConfigCommandOptions): Promise<void> {
  console.log("Config Sections:\n");

  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  const config = loadConfig(configPath);
  if (!config) {
    console.log(`  Config not found: ${configPath}`);
    process.exit(1);
  }

  const { sections, metadata } = getSectionsInfo(config);

  // Show sections with counts
  for (const key of [
    "models",
    "mcpServers",
    "context",
    "data",
    "rules",
    "prompts",
    "docs",
  ]) {
    const count = sections[key] || 0;
    const status = PRESERVED_SECTIONS.includes(key as any)
      ? "PRESERVED"
      : "MODIFIED";
    console.log(
      `  ${key.padEnd(15)} ${String(count).padStart(3)} entries  [${status}]`,
    );
  }

  // Show metadata
  console.log();
  for (const [key, value] of Object.entries(metadata)) {
    console.log(`  ${key.padEnd(15)} = ${value}`);
  }

  console.log("\n--- Legend ---");
  console.log("  PRESERVED = Not modified by sync/generate");
  console.log("  MODIFIED  = Updated by sync/generate");
}

/**
 * Validate command - Validate config structure
 */
async function runValidate(options: ConfigCommandOptions): Promise<void> {
  console.log("Validating config...\n");

  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  const config = loadConfig(configPath);
  if (!config) {
    console.error(`ERROR: Config not found: ${configPath}`);
    process.exit(1);
  }

  const errors = validateConfigStructure(config);

  if (errors.length > 0) {
    console.log("Validation FAILED:\n");
    for (const err of errors) {
      console.log(`  ✗ ${err}`);
    }
    process.exit(1);
  }

  const models = config.models as unknown[];
  console.log("  ✓ Config structure is valid");
  console.log(`  ✓ ${models?.length || 0} models defined`);
}

/**
 * List command - List available models from provider
 */
async function runList(options: ConfigCommandOptions): Promise<void> {
  try {
    const { apiBase, apiKey, authHeader } = getApiConfig(options);
    let modelIds = await queryModels(apiBase, apiKey, authHeader);

    // Apply filters
    modelIds = filterModels(modelIds, {
      pattern: options.filter,
      chatOnly: options.chatOnly,
      embedOnly: options.embedOnly,
      rerankOnly: options.rerankOnly,
    });

    const categories = categorizeModels(modelIds);

    if (options.json) {
      console.log(
        formatAsJson("list", {
          models: modelIds,
          categories,
          total: modelIds.length,
        }),
      );
      return;
    }

    console.log("Querying available models...\n");

    // If filtered to a specific type, just show that
    if (options.chatOnly) {
      console.log("Chat Models:");
      for (const m of categories.chat) {
        console.log(`  ${m}`);
      }
    } else if (options.embedOnly) {
      console.log("Embedding Models:");
      for (const m of categories.embed) {
        console.log(`  ${m}`);
      }
    } else if (options.rerankOnly) {
      console.log("Reranking Models:");
      for (const m of categories.rerank) {
        console.log(`  ${m}`);
      }
    } else {
      // Show all categories
      if (categories.chat.length > 0) {
        console.log("Chat Models:");
        for (const m of categories.chat) {
          console.log(`  ${m}`);
        }
      }

      if (categories.embed.length > 0) {
        console.log("\nEmbedding Models:");
        for (const m of categories.embed) {
          console.log(`  ${m}`);
        }
      }

      if (categories.rerank.length > 0) {
        console.log("\nReranking Models:");
        for (const m of categories.rerank) {
          console.log(`  ${m}`);
        }
      }
    }

    console.log(`\nTotal: ${modelIds.length} models`);
  } catch (error) {
    console.error(
      `ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Test command - Test each chat model with a real query
 */
async function runTest(options: ConfigCommandOptions): Promise<void> {
  console.log("Testing chat models...\n");

  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  const config = loadConfig(configPath);
  if (!config) {
    console.error(`ERROR: Config not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const { apiBase, apiKey, authHeader } = getApiConfig(options);
    const models = config.models as Array<{ model: string }>;
    if (!models || !Array.isArray(models)) {
      console.error("No models found in config");
      process.exit(1);
    }

    // Filter to chat models only
    const chatModels = models
      .map((m) => m.model)
      .filter(
        (m) =>
          !m.toLowerCase().includes("embed") &&
          !m.toLowerCase().includes("rerank") &&
          !m.toLowerCase().includes("bge"),
      );

    let allOk = true;
    for (const modelId of chatModels) {
      process.stdout.write(`  ${modelId.padEnd(55)} `);
      const result = await testModel(apiBase, apiKey, modelId, authHeader);
      if (result.success) {
        console.log("✓");
      } else {
        console.log(`✗ ${result.message}`);
        allOk = false;
      }
    }

    if (!allOk) {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Add command - Add a model to config
 */
async function runAdd(
  modelId: string,
  options: ConfigCommandOptions,
): Promise<void> {
  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  try {
    const { apiBase, authHeader } = getApiConfig(options, false);
    const apiKeyRef = options.apiKeyEnv
      ? `\${{ secrets.${options.apiKeyEnv} }}`
      : "${{ secrets.OPENAI_API_KEY }}";

    const result = await addModelToConfig(
      configPath,
      modelId,
      apiBase,
      apiKeyRef,
      {
        name: options.name,
        roles: options.role,
        authHeader,
        dryRun: options.dryRun,
      },
    );

    if (options.json) {
      console.log(formatAsJson("add", result));
      return;
    }

    if (result.added) {
      console.log(`✓ Added model: ${result.modelId}`);
      if (result.name) console.log(`  Name: ${result.name}`);
      if (result.roles) console.log(`  Roles: ${result.roles.join(", ")}`);
      if (options.dryRun) console.log("  (dry run - no changes made)");
    } else {
      console.error(`✗ Failed to add: ${result.reason}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Remove command - Remove a model from config
 */
async function runRemove(
  modelId: string,
  options: ConfigCommandOptions,
): Promise<void> {
  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  try {
    const result = await removeModelFromConfig(configPath, modelId, {
      dryRun: options.dryRun,
    });

    if (options.json) {
      console.log(formatAsJson("remove", result));
      return;
    }

    if (result.removed) {
      console.log(`✓ Removed model: ${result.modelId}`);
      if (result.dryRun) console.log("  (dry run - no changes made)");
    } else {
      console.error(`✗ Failed to remove: ${result.reason}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Generate command - Generate config from available models
 */
async function runGenerate(options: ConfigCommandOptions): Promise<void> {
  console.log("Generating config from available models...\n");

  try {
    const { apiBase, apiKey, authHeader } = getApiConfig(options);
    const modelIds = await queryModels(apiBase, apiKey, authHeader);

    const apiKeyRef = options.apiKeyEnv
      ? `\${{ secrets.${options.apiKeyEnv} }}`
      : "${{ secrets.OPENAI_API_KEY }}";

    const config = await generateConfig(modelIds, apiBase, apiKeyRef, {
      name: options.name || "Generated Config",
      chatOnly: options.chatOnly,
      embedOnly: options.embedOnly,
      rerankOnly: options.rerankOnly,
    });

    if (options.json) {
      console.log(formatAsJson("generate", config));
      return;
    }

    console.log(
      `Generated config with ${(config.models as any[]).length} models:\n`,
    );
    for (const model of config.models as any[]) {
      console.log(`  ${model.name} (${model.roles?.join(", ") || "chat"})`);
    }

    if (options.dryRun) {
      console.log("\n--- DRY RUN (config not saved) ---");
    } else {
      const continueHome = getContinueHome(options.continueHome);
      const configPath = getConfigPath(continueHome);
      const fs = await import("fs");
      const yaml = await import("yaml");

      // Backup existing config if it exists
      if (fs.existsSync(configPath)) {
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const backupPath = configPath.replace(
          ".yaml",
          `.backup-${timestamp}.yaml`,
        );
        fs.copyFileSync(configPath, backupPath);
        console.log(`\nBacked up existing config to: ${backupPath}`);
      }

      fs.writeFileSync(configPath, yaml.stringify(config));
      console.log(`\nConfig saved to: ${configPath}`);
    }
  } catch (error) {
    console.error(
      `ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Diff command - Show difference between config and available models
 */
async function runDiff(options: ConfigCommandOptions): Promise<void> {
  console.log("Comparing config with available models...\n");

  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  try {
    const { apiBase, apiKey, authHeader } = getApiConfig(options);
    const config = loadConfig(configPath);
    if (!config) {
      console.error(`ERROR: Config not found: ${configPath}`);
      process.exit(1);
    }

    const configModels = getConfigModelIds(config);
    const availableModels = await queryModels(apiBase, apiKey, authHeader);

    const result = diffModels(configModels, availableModels);

    if (options.json) {
      console.log(formatAsJson("diff", result));
      return;
    }

    if (result.inConfigNotAvailable.length > 0) {
      console.log("In config but NOT available:");
      for (const m of result.inConfigNotAvailable) {
        console.log(`  ✗ ${m}`);
      }
    }

    if (result.availableNotInConfig.length > 0) {
      console.log("\nAvailable but NOT in config:");
      for (const m of result.availableNotInConfig) {
        console.log(`  + ${m}`);
      }
    }

    if (result.inBoth.length > 0) {
      console.log(`\nIn both (${result.inBoth.length} models):`);
      for (const m of result.inBoth) {
        console.log(`  ✓ ${m}`);
      }
    }

    console.log(`\nSummary:`);
    console.log(`  Config: ${configModels.length} models`);
    console.log(`  Available: ${availableModels.length} models`);
    console.log(`  In both: ${result.inBoth.length}`);
    console.log(`  Only in config: ${result.inConfigNotAvailable.length}`);
    console.log(`  Only available: ${result.availableNotInConfig.length}`);
  } catch (error) {
    console.error(
      `ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Show command - Display current config
 */
async function runShow(options: ConfigCommandOptions): Promise<void> {
  const continueHome = getContinueHome(options.continueHome);
  const configPath = getConfigPath(continueHome);

  const config = loadConfig(configPath);
  if (!config) {
    console.error(`ERROR: Config not found: ${configPath}`);
    process.exit(1);
  }

  if (options.json) {
    console.log(formatAsJson("show", config));
    return;
  }

  const { sections, metadata } = getSectionsInfo(config);
  const models = (config.models as any[]) || [];

  console.log(`Config: ${configPath}\n`);

  // Metadata
  for (const [key, value] of Object.entries(metadata)) {
    console.log(`${key}: ${value}`);
  }
  console.log();

  // Models
  console.log(`Models (${models.length}):`);
  for (const model of models) {
    const roles = model.roles ? ` [${model.roles.join(", ")}]` : "";
    console.log(`  ${model.name || model.model}${roles}`);
    console.log(`    model: ${model.model}`);
    console.log(`    provider: ${model.provider}`);
  }

  // Other sections
  for (const key of [
    "mcpServers",
    "context",
    "data",
    "rules",
    "prompts",
    "docs",
  ]) {
    const count = sections[key] || 0;
    if (count > 0) {
      console.log(`\n${key}: ${count} entries`);
    }
  }
}

/**
 * Backups command - List available backups
 */
async function runBackups(options: ConfigCommandOptions): Promise<void> {
  const continueHome = getContinueHome(options.continueHome);
  const backups = listBackups(continueHome);

  if (options.json) {
    console.log(formatAsJson("backups", { backups, continueHome }));
    return;
  }

  console.log(`Backups in ${continueHome}:\n`);

  if (backups.length === 0) {
    console.log("  No backups found.");
    return;
  }

  for (const backup of backups) {
    console.log(`  ${backup}`);
  }

  console.log(`\nTotal: ${backups.length} backup(s)`);
  console.log("\nTo restore: cn config restore <backup-filename>");
}

/**
 * Restore command - Restore from a backup
 */
async function runRestore(
  backupFilename: string,
  options: ConfigCommandOptions,
): Promise<void> {
  const continueHome = getContinueHome(options.continueHome);

  if (options.dryRun) {
    console.log(`DRY RUN: Would restore from ${backupFilename}`);
    return;
  }

  const result = restoreBackup(continueHome, backupFilename);

  if (options.json) {
    console.log(formatAsJson("restore", result));
    return;
  }

  if (result.restored) {
    console.log(`✓ Restored config from: ${backupFilename}`);
    console.log("  (Previous config was backed up first)");
  } else {
    console.error(`✗ Restore failed: ${result.reason}`);
    process.exit(1);
  }
}

/**
 * Register the config command with its subcommands
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("Manage config.yaml models and settings");

  // Common options for API access
  const addApiOptions = (cmd: Command) => {
    return cmd
      .option("--api-base <url>", "API base URL (default: from env or OpenAI)")
      .option("--api-key <key>", "API key (default: from env)")
      .option("--api-key-env <name>", "Environment variable name for API key")
      .option(
        "--auth-header <name>",
        "Auth header name (default: Authorization)",
      )
      .option(
        "--provider <name>",
        "Provider preset (openai, anthropic, azure, ollama, together, groq, mistral)",
      )
      .option("--continue-home <path>", "Continue home directory");
  };

  // cn config verify
  addApiOptions(
    configCmd
      .command("verify")
      .description("Check if config models are available from provider"),
  ).action(runVerify);

  // cn config sync
  addApiOptions(
    configCmd
      .command("sync")
      .description(
        "Remove unavailable models from config (preserves other sections)",
      )
      .option("--dry-run", "Preview changes without modifying files"),
  ).action(runSync);

  // cn config sections
  configCmd
    .command("sections")
    .description("Show what sections exist in config")
    .option("--continue-home <path>", "Continue home directory")
    .action(runSections);

  // cn config validate
  configCmd
    .command("validate")
    .description("Validate config structure")
    .option("--continue-home <path>", "Continue home directory")
    .action(runValidate);

  // cn config list
  addApiOptions(
    configCmd
      .command("list")
      .description("List available models from provider")
      .option("--chat-only", "Only show chat models")
      .option("--embed-only", "Only show embedding models")
      .option("--rerank-only", "Only show reranking models")
      .option("--filter <pattern>", "Filter models by pattern")
      .option("--json", "Output as JSON"),
  ).action(runList);

  // cn config test
  addApiOptions(
    configCmd
      .command("test")
      .description("Test each chat model with a real query"),
  ).action(runTest);

  // cn config add <model>
  addApiOptions(
    configCmd
      .command("add <model>")
      .description("Add a model to config")
      .option("--name <name>", "Custom display name for the model")
      .option("--role <role...>", "Model roles (chat, embed, rerank)")
      .option("--dry-run", "Preview changes without modifying files")
      .option("--json", "Output as JSON"),
  ).action(runAdd);

  // cn config remove <model>
  configCmd
    .command("remove <model>")
    .description("Remove a model from config")
    .option("--continue-home <path>", "Continue home directory")
    .option("--dry-run", "Preview changes without modifying files")
    .option("--json", "Output as JSON")
    .action(runRemove);

  // cn config generate
  addApiOptions(
    configCmd
      .command("generate")
      .description("Generate config from available models")
      .option("--name <name>", "Config name (default: Generated Config)")
      .option("--chat-only", "Only include chat models")
      .option("--embed-only", "Only include embedding models")
      .option("--rerank-only", "Only include reranking models")
      .option("--dry-run", "Preview without saving")
      .option("--json", "Output as JSON"),
  ).action(runGenerate);

  // cn config diff
  addApiOptions(
    configCmd
      .command("diff")
      .description("Show difference between config and available models")
      .option("--json", "Output as JSON"),
  ).action(runDiff);

  // cn config show
  configCmd
    .command("show")
    .description("Display current config")
    .option("--continue-home <path>", "Continue home directory")
    .option("--json", "Output as JSON")
    .action(runShow);

  // cn config backups
  configCmd
    .command("backups")
    .description("List available config backups")
    .option("--continue-home <path>", "Continue home directory")
    .option("--json", "Output as JSON")
    .action(runBackups);

  // cn config restore <backup>
  configCmd
    .command("restore <backup>")
    .description("Restore config from a backup file")
    .option("--continue-home <path>", "Continue home directory")
    .option("--dry-run", "Preview without restoring")
    .option("--json", "Output as JSON")
    .action(runRestore);
}
