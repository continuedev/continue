import { BaseLlmApi } from "@continuedev/openai-adapters";
import { ContinueClient } from "@continuedev/sdk";
import { render } from "ink";
import React from "react";
import { introMessage } from "../intro.js";
import { MCPService } from "../mcp.js";
import TUIChat from "./TUIChat.js";

export { default as MarkdownRenderer } from "./MarkdownRenderer.js";

export async function startTUIChat(
  assistant: ContinueClient["assistant"],
  llmApi: BaseLlmApi,
  model: string,
  mcpService: MCPService,
  initialPrompt?: string,
  resume?: boolean
) {
  // Show intro message before starting TUI
  introMessage(assistant, mcpService);

  // Start the TUI
  const { unmount } = render(
    React.createElement(TUIChat, {
      assistant,
      model,
      llmApi,
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
