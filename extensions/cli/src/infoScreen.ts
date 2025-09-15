import { execSync } from "child_process";

import chalk from "chalk";

import {
  isAuthenticated,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "./auth/workos.js";
import { services } from "./services/index.js";
import { getCurrentSession, getSessionFilePath } from "./session.js";
import { posthogService } from "./telemetry/posthogService.js";
import { logger } from "./util/logger.js";
import { getVersion } from "./version.js";

export async function handleInfoSlashCommand() {
  posthogService.capture("useSlashCommand", { name: "info" });

  const infoLines = [];

  // Version and working directory info
  const version = getVersion();
  const cwd = process.cwd();

  infoLines.push(
    chalk.white("CLI Information:"),
    `  Version: ${chalk.green(version)}`,
    `  Working Directory: ${chalk.blue(cwd)}`,
  );

  // Auth info
  if (isAuthenticated()) {
    const config = loadAuthConfig();
    if (config && isAuthenticatedConfig(config)) {
      const email = config.userEmail || config.userId;
      const orgId = config.organizationId;
      infoLines.push(
        "",
        chalk.white("Authentication:"),
        `  Email: ${chalk.green(email)}`,
        `  Org ID: ${chalk.cyan(orgId)}`,
      );
    } else {
      infoLines.push(
        "",
        chalk.white("Authentication:"),
        `  ${chalk.yellow("Authenticated via environment variable")}`,
      );
    }
  } else {
    infoLines.push(
      "",
      chalk.white("Authentication:"),
      `  ${chalk.red("Not logged in")}`,
    );
  }

  // Config info
  try {
    const configState = services.config.getState();
    infoLines.push("", chalk.white("Configuration:"));
    if (configState.config) {
      infoLines.push(`  ${chalk.gray(`Using ${configState.config?.name}`)}`);
    } else {
      infoLines.push(`  ${chalk.red(`Config not found`)}`);
    }
    if (configState.configPath) {
      infoLines.push(`  Path: ${chalk.blue(configState.configPath)}`);
    }

    // Add current model info
    try {
      const modelInfo = services.model?.getModelInfo();
      if (modelInfo) {
        infoLines.push(`  Model: ${chalk.cyan(modelInfo.name)}`);
      } else {
        infoLines.push(`  Model: ${chalk.red("Not available")}`);
      }
    } catch {
      infoLines.push(`  Model: ${chalk.red("Error retrieving model info")}`);
    }
  } catch {
    infoLines.push(
      "",
      chalk.white("Configuration:"),
      `  ${chalk.red("Configuration service not available")}`,
    );
  }

  // Session info
  infoLines.push("", chalk.white("Session:"));
  try {
    const currentSession = getCurrentSession();
    const sessionFilePath = getSessionFilePath();
    infoLines.push(
      `  Title: ${chalk.green(currentSession.title)}`,
      `  ID: ${chalk.gray(currentSession.sessionId)}`,
      `  File: ${chalk.blue(sessionFilePath)}`,
    );
  } catch {
    infoLines.push(`  ${chalk.red("Session not available")}`);
  }

  // Runtime diagnostic info
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
    // If npm command fails, fallback to "unknown"
    logger.warn("Failed to get npm version:", error);
  }

  // Diagnostic info
  infoLines.push(
    "",
    chalk.white("Diagnostic Info"),
    `  Currently running: npm-global (${chalk.green(npmVersion)})`,
    `  Path: ${chalk.blue(nodePath)}`,
    `  Invoked: ${chalk.blue(invokedPath)}`,
  );

  // TODO add global settings like auto update etc.

  return {
    exit: false,
    output: infoLines.join("\n"),
  };
}
