import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

import chalk from "chalk";

import { formatError } from "../util/formatError.js";
import { logger } from "../util/logger.js";

interface EnvironmentConfig {
  install?: string;
}

const ENVIRONMENT_FILE_NAME = "environment.json";
const ENVIRONMENT_SEARCH_PATHS = [".continue"];

/**
 * Finds and reads the environment.json file
 */
function findEnvironmentFile(): EnvironmentConfig | null {
  for (const searchPath of ENVIRONMENT_SEARCH_PATHS) {
    const environmentPath = path.join(
      process.cwd(),
      searchPath,
      ENVIRONMENT_FILE_NAME,
    );

    if (existsSync(environmentPath)) {
      try {
        const content = readFileSync(environmentPath, "utf-8");
        const config = JSON.parse(content) as EnvironmentConfig;
        logger.debug(`Found environment.json at: ${environmentPath}`);
        return config;
      } catch (error) {
        logger.error(
          `Failed to parse environment.json at ${environmentPath}: ${formatError(error)}`,
        );
        return null;
      }
    }
  }

  logger.debug("No environment.json file found");
  return null;
}

/**
 * Runs the install script from environment.json if present
 */
export async function runEnvironmentInstall(): Promise<void> {
  const environmentConfig = findEnvironmentFile();

  if (!environmentConfig || !environmentConfig.install) {
    logger.debug("No install script found in environment.json, skipping...");
    return;
  }

  const installScript = environmentConfig.install;
  logger.debug(
    chalk.blue(
      `\nRunning environment install script: ${chalk.dim(installScript)}`,
    ),
  );

  try {
    execSync(installScript, {
      stdio: "inherit",
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    logger.debug(
      chalk.green("✓ Environment install script completed successfully"),
    );
  } catch (error) {
    logger.error(`Environment install script failed: ${formatError(error)}`);
    throw new Error(
      `Failed to run environment install script: ${formatError(error)}`,
    );
  }
}

/**
 * Gets the environment configuration if available
 */
export function getEnvironmentConfig(): EnvironmentConfig | null {
  return findEnvironmentFile();
}
