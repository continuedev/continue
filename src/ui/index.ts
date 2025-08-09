import { render } from "ink";
import React from "react";

import { PermissionMode } from "../permissions/types.js";
import { initializeServices } from "../services/index.js";
import { ServiceContainerProvider } from "../services/ServiceContainerContext.js";

import { AppRoot } from "./AppRoot.js";

export { MarkdownRenderer } from "./MarkdownRenderer.js";

export async function startTUIChat(
  initialPrompt?: string,
  resume?: boolean,
  configPath?: string,
  organizationSlug?: string,
  additionalRules?: string[],
  toolPermissionOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
    mode?: PermissionMode;
  },
  skipOnboarding?: boolean,
) {
  // Initialize services only if not already done (skipOnboarding means already initialized)
  if (!skipOnboarding) {
    initializeServices({
      configPath,
      organizationSlug,
      rules: additionalRules,
      headless: false,
      toolPermissionOverrides,
    }).catch((error) => {
      console.error("Failed to initialize services:", error);
    });
  }

  // Start the TUI immediately - it will handle loading states
  const { unmount } = render(
    React.createElement(ServiceContainerProvider, {
      children: React.createElement(AppRoot, {
        configPath,
        initialPrompt,
        resume,
        additionalRules,
      }),
    }),
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
  initialPrompt?: string,
) {
  // Start the TUI in remote mode - no services needed
  const { unmount } = render(
    React.createElement(ServiceContainerProvider, {
      children: React.createElement(AppRoot, {
        remoteUrl,
        initialPrompt,
      }),
    }),
  );

  // Handle cleanup
  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });

  return { unmount };
}
