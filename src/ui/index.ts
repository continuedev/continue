import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import { render } from "ink";
import React from "react";
import { introMessage } from "../intro.js";
import { MCPService } from "../mcp.js";
import TUIChat from "./TUIChat.js";

export { default as MarkdownRenderer } from "./MarkdownRenderer.js";

export async function startTUIChat(
  config: AssistantUnrolled,
  llmApi: BaseLlmApi,
  model: ModelConfig,
  mcpService: MCPService,
  apiClient?: DefaultApiInterface,
  initialPrompt?: string,
  resume?: boolean,
  configPath?: string,
  additionalRules?: string[]
) {
  // Show intro message before starting TUI
  introMessage(config, model, mcpService);

  // Start the TUI
  const { unmount } = render(
    React.createElement(TUIChat, {
      config: config,
      model,
      llmApi,
      mcpService,
      apiClient,
      configPath,
      initialPrompt,
      resume,
      additionalRules,
    })
  );

  // Handle cleanup
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });

  return { unmount };
}

export async function startRemoteTUIChat(
  remoteUrl: string,
  initialPrompt?: string
) {
  // Start the TUI in remote mode
  const { unmount } = render(
    React.createElement(TUIChat, {
      remoteUrl,
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
