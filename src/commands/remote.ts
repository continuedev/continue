import chalk from "chalk";

import {
  getAccessToken,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "../auth/workos.js";
import { env } from "../env.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { startRemoteTUIChat } from "../ui/index.js";
import { getRepoUrl } from "../util/git.js";
import { logger } from "../util/logger.js";

export async function remote(
  prompt: string | undefined,
  options: { url?: string; idempotencyKey?: string } = {}
) {
  // If --url is provided, connect directly to that URL
  if (options.url) {
    console.info(
      chalk.white(`Connecting to remote environment at: ${options.url}`),
    );

    // Record session start
    telemetryService.recordSessionStart();
    telemetryService.startActiveTime();

    try {
      // Start the TUI in remote mode
      await startRemoteTUIChat(options.url, prompt);
    } finally {
      telemetryService.stopActiveTime();
    }
    return;
  }

  console.info(chalk.white("Setting up remote development environment..."));

  try {
    const authConfig = loadAuthConfig();

    if (!isAuthenticatedConfig(authConfig)) {
      console.error(
        chalk.red("Not authenticated. Please run 'cn login' first."),
      );
      process.exit(1);
    }

    const accessToken = getAccessToken(authConfig);

    const requestBody: any = {
      cUserId: authConfig.userId,
      repoUrl: getRepoUrl(),
      name: `devbox-${Date.now()}`,
      prompt: prompt,
      idempotencyKey: options.idempotencyKey,
    };

    const response = await fetch(new URL("agents/devboxes", env.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create remote environment: ${response.status} ${errorText}`,
      );
    }

    const result = await response.json();

    console.info(
      chalk.green("✅ Remote development environment created successfully!"),
    );

    if (result.url && result.port) {
      const remoteUrl = result.url;
      console.info(
        chalk.white(`Connecting to remote environment at: ${remoteUrl}`),
      );

      // Record session start
      telemetryService.recordSessionStart();
      telemetryService.startActiveTime();

      try {
        // Start the TUI in remote mode (prompt is optional)
        await startRemoteTUIChat(remoteUrl, prompt);
      } finally {
        telemetryService.stopActiveTime();
      }
    } else {
      throw new Error(
        "No URL or port returned from remote environment creation",
      );
    }
  } catch (error: any) {
    logger.error(
      chalk.red(`Failed to create remote environment: ${error.message}`),
    );
    process.exit(1);
  }
}
