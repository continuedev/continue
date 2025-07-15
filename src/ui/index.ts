import { AssistantUnrolled } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { render } from "ink";
import React from "react";
import { introMessage } from "../intro.js";
import { MCPService } from "../mcp.js";
import TUIChat from "./TUIChat.js";

export { default as MarkdownRenderer } from "./MarkdownRenderer.js";

export async function startTUIChat(
  config: AssistantUnrolled,
  llmApi: BaseLlmApi,
  model: string,
  mcpService: MCPService,
  initialPrompt?: string,
  resume?: boolean,
  configPath?: string
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
      configPath,
      initialPrompt,
      resume,
    })
  );

  // Handle cleanup
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });

  return { unmount };
}
