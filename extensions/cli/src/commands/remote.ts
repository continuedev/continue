import chalk from "chalk";

import { env } from "../env.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { startRemoteTUIChat } from "../ui/index.js";
import {
  ApiRequestError,
  AuthenticationRequiredError,
  post,
} from "../util/apiClient.js";
import { gracefulExit } from "../util/exit.js";
import { getRepoUrl } from "../util/git.js";
import { logger } from "../util/logger.js";
import { readStdinSync } from "../util/stdin.js";

type RemoteCommandOptions = {
  url?: string;
  id?: string;
  idempotencyKey?: string;
  start?: boolean;
  branch?: string;
  repo?: string;
  config?: string;
  agent?: string;
};

type TunnelResponse = {
  url: string;
  port?: number;
};

type AgentCreationResponse = TunnelResponse & {
  id: string;
};

export async function remote(
  prompt: string | undefined,
  options: RemoteCommandOptions = {},
) {
  const actualPrompt = resolvePrompt(prompt);

  try {
    if (options.url) {
      await connectToRemoteUrl(options.url, actualPrompt, options.start);
      return;
    }

    if (options.id) {
      await connectExistingAgent(options.id, actualPrompt, options.start);
      return;
    }

    await createAndConnectRemoteEnvironment(actualPrompt, options);
  } catch (error) {
    await handleRemoteError(error);
  }
}

function resolvePrompt(prompt: string | undefined): string | undefined {
  const stdinInput = readStdinSync();

  if (!stdinInput) {
    return prompt;
  }

  if (!prompt) {
    return stdinInput;
  }

  return `<stdin>\n${stdinInput}\n</stdin>\n\n${prompt}`;
}

async function connectToRemoteUrl(
  remoteUrl: string,
  prompt: string | undefined,
  startOnly?: boolean,
) {
  if (startOnly) {
    printStartJson({
      status: "success",
      message: "Remote environment connection details",
      url: remoteUrl,
      mode: "direct_url",
    });
    return;
  }

  console.info(
    chalk.white(`Connecting to remote environment at: ${remoteUrl}`),
  );
  await launchRemoteTUI(remoteUrl, prompt);
}

async function connectExistingAgent(
  agentId: string,
  prompt: string | undefined,
  startOnly?: boolean,
) {
  const tunnel = await fetchAgentTunnel(agentId);

  if (startOnly) {
    printStartJson({
      status: "success",
      message: "Remote agent tunnel connection details",
      url: tunnel.url,
      containerPort: tunnel.port,
      agentId,
      mode: "existing_agent",
    });
    return;
  }

  console.info(
    chalk.white(`Connecting to remote agent tunnel at: ${tunnel.url}`),
  );
  await launchRemoteTUI(tunnel.url, prompt);
}

async function createAndConnectRemoteEnvironment(
  prompt: string | undefined,
  options: RemoteCommandOptions,
) {
  const requestBody = buildAgentRequestBody(options, prompt);

  let result: AgentCreationResponse;
  try {
    const response = await post<AgentCreationResponse>("agents", requestBody);
    result = response.data;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new Error(
        `Failed to create remote environment: ${error.status} ${error.response || error.statusText}`,
      );
    }
    throw error;
  }

  if (options.start) {
    printStartJson({
      status: "success",
      message: "Remote development environment created successfully",
      url: `${env.appUrl}/agents/${result.id}`,
      containerUrl: result.url,
      containerPort: result.port,
      name: requestBody.name,
      mode: "new_environment",
    });
    return;
  }

  console.info(
    chalk.green("✅ Remote development environment created successfully!"),
  );

  if (!result.url) {
    throw new Error("No URL returned from remote environment creation");
  }

  console.info(
    chalk.white(`Connecting to remote environment at: ${result.url}`),
  );
  await launchRemoteTUI(result.url, prompt);
}

function buildAgentRequestBody(
  options: RemoteCommandOptions,
  prompt: string | undefined,
) {
  const body: Record<string, unknown> = {
    repoUrl: options.repo ?? getRepoUrl(),
    name: `devbox-${Date.now()}`,
    prompt,
    agent: options.agent,
    config: options.config,
  };

  if (options.idempotencyKey) {
    body.idempotencyKey = options.idempotencyKey;
  }

  if (options.branch) {
    body.branchName = options.branch;
  }

  return body;
}

async function fetchAgentTunnel(agentId: string) {
  try {
    const response = await post<TunnelResponse>(`agents/${agentId}/tunnel`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new Error(
        `Failed to create tunnel for agent ${agentId}: ${error.status} ${error.response || error.statusText}`,
      );
    }
    throw error;
  }
}

async function launchRemoteTUI(remoteUrl: string, prompt: string | undefined) {
  telemetryService.recordSessionStart();
  telemetryService.startActiveTime();

  try {
    await startRemoteTUIChat(remoteUrl, prompt);
  } finally {
    telemetryService.stopActiveTime();
  }
}

function printStartJson(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload));
}

async function handleRemoteError(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    logger.error(chalk.red(error.message));
  } else if (error instanceof Error) {
    logger.error(chalk.red(error.message));
  } else {
    logger.error(chalk.red("An unknown error occurred while starting remote"));
  }

  await gracefulExit(1);
}
