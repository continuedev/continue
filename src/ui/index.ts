import { ContinueClient } from "@continuedev/sdk";
import chalk from "chalk";
import { render } from "ink";
import React from "react";
import { loadAuthConfig } from "../auth/workos.js";
import { initializeContinueSDK } from "../continueSDK.js";
import { introMessage } from "../intro.js";
import { MCPService } from "../mcp.js";
import TUIChat from "./TUIChat.js";

export async function startTUIChat(configPath: string, initialPrompt?: string) {
  const authConfig = loadAuthConfig();

  let assistant: ContinueClient["assistant"];
  let client: ContinueClient["client"];

  try {
    const continueSdk = await initializeContinueSDK(
      authConfig.accessToken,
      configPath
    );

    assistant = continueSdk.assistant;
    client = continueSdk.client;
  } catch (error) {
    console.error(chalk.red(`Error loading assistant ${configPath}:`), error);
    throw error;
  }

  const mcpService = await MCPService.create(assistant.config);

  // Show intro message before starting TUI
  introMessage(assistant, mcpService);

  // Start the TUI
  const { unmount } = render(
    React.createElement(TUIChat, {
      assistant,
      client,
      initialPrompt,
    })
  );

  // Handle cleanup
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });

  return { unmount };
}
