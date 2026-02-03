import { execSync } from "child_process";

import chalk from "chalk";

import {
  isAuthenticated,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "./auth/workos.js";
import { services } from "./services/index.js";
import {
  getCurrentSession,
  getSessionFilePath,
  getSessionUsage,
} from "./session.js";
import { logger } from "./util/logger.js";
import { getVersion } from "./version.js";

function getVersionInfo(): string[] {
  const version = getVersion();
  const cwd = process.cwd();

  return [
    chalk.white("CLI Information:"),
    `  Version: ${chalk.green(version)}`,
    `  Working Directory: ${chalk.blue(cwd)}`,
  ];
}

async function getAuthInfo(): Promise<string[]> {
  const lines: string[] = ["", chalk.white("Authentication:")];

  if (await isAuthenticated()) {
    const config = loadAuthConfig();
    if (config && isAuthenticatedConfig(config)) {
      const email = config.userEmail || config.userId;
      const orgId = config.organizationId;
      lines.push(
        `  Email: ${chalk.green(email)}`,
        `  Org ID: ${chalk.cyan(orgId)}`,
      );
    } else {
      lines.push(`  ${chalk.yellow("Authenticated via environment variable")}`);
    }
  } else {
    lines.push(`  ${chalk.red("Not logged in")}`);
  }

  return lines;
}

function getConfigInfo(): string[] {
  const lines: string[] = ["", chalk.white("Configuration:")];

  try {
    const configState = services.config.getState();
    if (configState.config) {
      lines.push(`  ${chalk.gray(`Using ${configState.config?.name}`)}`);
    } else {
      lines.push(`  ${chalk.red(`Config not found`)}`);
    }
    if (configState.configPath) {
      lines.push(`  Path: ${chalk.blue(configState.configPath)}`);
    }

    // Add current model info
    try {
      const modelInfo = services.model?.getModelInfo();
      if (modelInfo) {
        lines.push(`  Model: ${chalk.cyan(modelInfo.name)}`);
      } else {
        lines.push(`  Model: ${chalk.red("Not available")}`);
      }
    } catch {
      lines.push(`  Model: ${chalk.red("Error retrieving model info")}`);
    }
  } catch {
    lines.push(`  ${chalk.red("Configuration service not available")}`);
  }

  return lines;
}

function getSessionInfo(): string[] {
  const lines: string[] = ["", chalk.white("Session:")];

  try {
    const currentSession = getCurrentSession();
    const sessionFilePath = getSessionFilePath();
    lines.push(
      `  Title: ${chalk.green(currentSession.title)}`,
      `  ID: ${chalk.gray(currentSession.sessionId)}`,
      `  File: ${chalk.blue(sessionFilePath)}`,
    );
  } catch {
    lines.push(`  ${chalk.red("Session not available")}`);
  }

  return lines;
}

function getUsageInfo(): string[] {
  const lines: string[] = ["", chalk.white("Usage:")];

  try {
    const usage = getSessionUsage();
    if (usage.totalCost > 0) {
      lines.push(
        `  Total Cost: ${chalk.green(`$${usage.totalCost.toFixed(6)}`)}`,
      );
      lines.push(
        `  Input Tokens: ${chalk.cyan(usage.promptTokens.toLocaleString())}`,
      );
      lines.push(
        `  Output Tokens: ${chalk.cyan(usage.completionTokens.toLocaleString())}`,
      );

      if (usage.promptTokensDetails?.cachedTokens) {
        lines.push(
          `  Cache Read Tokens: ${chalk.cyan(usage.promptTokensDetails.cachedTokens.toLocaleString())}`,
        );
      }

      if (usage.promptTokensDetails?.cacheWriteTokens) {
        lines.push(
          `  Cache Write Tokens: ${chalk.cyan(usage.promptTokensDetails.cacheWriteTokens.toLocaleString())}`,
        );
      }

      const totalTokens = usage.promptTokens + usage.completionTokens;
      lines.push(`  Total Tokens: ${chalk.cyan(totalTokens.toLocaleString())}`);
    } else {
      lines.push(`  ${chalk.gray("No usage data yet")}`);
    }
  } catch (error) {
    logger.warn("Failed to get session usage:", error);
    lines.push(`  ${chalk.red("Usage data not available")}`);
  }

  return lines;
}

function getDiagnosticInfo(): string[] {
  const nodePath = process.execPath;
  const invokedPath = process.argv[1];

  // Get npm version
  let npmVersion = "unknown";
  try {
    npmVersion = execSync("npm --version", {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    logger.warn("Failed to get npm version:", error);
  }

  return [
    "",
    chalk.white("Diagnostic Info"),
    `  Currently running: npm-global (${chalk.green(npmVersion)})`,
    `  Path: ${chalk.blue(nodePath)}`,
    `  Invoked: ${chalk.blue(invokedPath)}`,
  ];
}

export async function handleInfoSlashCommand() {
  const infoLines = [
    ...getVersionInfo(),
    ...(await getAuthInfo()),
    ...getConfigInfo(),
    ...getSessionInfo(),
    ...getUsageInfo(),
    ...getDiagnosticInfo(),
  ];

  return {
    exit: false,
    output: infoLines.join("\n"),
  };
}
