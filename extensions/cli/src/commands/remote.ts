import chalk from "chalk";

import { getAccessToken, loadAuthConfig } from "../auth/workos.js";
import { env } from "../env.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { startRemoteTUIChat } from "../ui/index.js";
import { getRepoUrl } from "../util/git.js";
import { logger } from "../util/logger.js";
import { readStdinSync } from "../util/stdin.js";

export async function remote(
  prompt: string | undefined,
  options: {
    url?: string;
    idempotencyKey?: string;
    start?: boolean;
    branch?: string;
    repo?: string;
    config?: string;
  } = {},
) {
  // Check if prompt should come from stdin instead of parameter
  let actualPrompt = prompt;
  if (prompt) {
    // If prompt is provided, still check for stdin and combine them
    const stdinInput = readStdinSync();
    if (stdinInput) {
      // Combine stdin and prompt argument - stdin comes first in XML block
      actualPrompt = `<stdin>\n${stdinInput}\n</stdin>\n\n${prompt}`;
    }
  } else {
    // Try to read from stdin (for piped input like: echo "hello" | cn remote -s)
    const stdinInput = readStdinSync();
    if (stdinInput) {
      actualPrompt = stdinInput;
    }
  }
  // If --url is provided, connect directly to that URL
  if (options.url) {
    if (options.start) {
      // In start mode, output connection details as JSON and exit
      console.log(
        JSON.stringify({
          status: "success",
          message: "Remote environment connection details",
          url: options.url,
          mode: "direct_url",
        }),
      );
      return;
    }

    console.info(
      chalk.white(`Connecting to remote environment at: ${options.url}`),
    );

    // Record session start
    telemetryService.recordSessionStart();
    telemetryService.startActiveTime();

    try {
      // Start the TUI in remote mode
      await startRemoteTUIChat(options.url, actualPrompt);
    } finally {
      telemetryService.stopActiveTime();
    }
    return;
  }

  try {
    const authConfig = loadAuthConfig();

    // Check if we have any valid authentication (file-based or environment variable)
    if (!authConfig || !getAccessToken(authConfig)) {
      console.error(
        chalk.red("Not authenticated. Please run 'cn login' first."),
      );
      process.exit(1);
    }

    const accessToken = getAccessToken(authConfig);

    const requestBody: any = {
      repoUrl: options.repo || getRepoUrl(),
      name: `devbox-${Date.now()}`,
      prompt: actualPrompt,
      idempotencyKey: options.idempotencyKey,
      agent: options.config,
      config: options.config,
    };

    // Add branchName to request body if branch option is provided
    if (options.branch) {
      requestBody.branchName = options.branch;
    }

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

    if (options.start) {
      // In start mode, output connection details as JSON and exit
      console.log(
        JSON.stringify({
          status: "success",
          message: "Remote development environment created successfully",
          url: `${env.appUrl}/agents/${result.id}`,
          containerUrl: result.url,
          containerPort: result.port,
          name: requestBody.name,
          mode: "new_environment",
        }),
      );
      return;
    }

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
        await startRemoteTUIChat(remoteUrl, actualPrompt);
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
