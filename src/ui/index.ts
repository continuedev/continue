import { render } from "ink";
import React from "react";

import { PermissionMode } from "../permissions/types.js";
import { initializeServices } from "../services/index.js";
import { ServiceContainerProvider } from "../services/ServiceContainerContext.js";

import { TUIChat } from "./TUIChat.js";

export { MarkdownRenderer } from "./MarkdownRenderer.js";

export async function startTUIChat(
  initialPrompt?: string,
  resume?: boolean,
  configPath?: string,
  additionalRules?: string[],
  toolPermissionOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
    mode?: PermissionMode;
  }
) {
  // Initialize services in the background - TUI will show loading states
  initializeServices({
    configPath,
    rules: additionalRules,
    headless: false,
    toolPermissionOverrides,
  }).catch((error) => {
    console.error("Failed to initialize services:", error);
  });

  // Start the TUI immediately - it will handle loading states
  const { unmount } = render(
    React.createElement(ServiceContainerProvider, {
      children: React.createElement(TUIChat, {
        configPath,
        initialPrompt,
        resume,
        additionalRules,
      })
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
  // Start the TUI in remote mode - no services needed
  const { unmount } = render(
    React.createElement(ServiceContainerProvider, {
      children: React.createElement(TUIChat, {
        remoteUrl,
        initialPrompt,
      })
    })
  );

  // Handle cleanup
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });

  return { unmount };
}
