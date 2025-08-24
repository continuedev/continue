import { render } from "ink";
import React from "react";

import { PermissionMode } from "../permissions/types.js";
import { initializeServices } from "../services/index.js";
import { ServiceContainerProvider } from "../services/ServiceContainerContext.js";

import { AppRoot } from "./AppRoot.js";

export { MarkdownRenderer } from "./MarkdownRenderer.js";

interface StartTUIChatOptions {
  initialPrompt?: string;
  resume?: boolean;
  configPath?: string;
  organizationSlug?: string;
  additionalRules?: string[];
  additionalPrompts?: string[];
  toolPermissionOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
    mode?: PermissionMode;
  };
  skipOnboarding?: boolean;
}

export async function startTUIChat(
  options: StartTUIChatOptions & { customStdin?: NodeJS.ReadStream },
) {
  const {
    initialPrompt,
    resume,
    configPath,
    organizationSlug,
    additionalRules,
    additionalPrompts,
    toolPermissionOverrides,
    skipOnboarding,
    customStdin,
  } = options;

  // Initialize services only if not already done (skipOnboarding means already initialized)
  if (!skipOnboarding) {
    await initializeServices({
      configPath,
      organizationSlug,
      rules: additionalRules,
      headless: false,
      toolPermissionOverrides,
    });
  }

  // Use static imports since we're always loading TUI when there's piped input

  // Start the TUI immediately - it will handle loading states
  const renderOptions: any = {};
  if (customStdin) {
    renderOptions.stdin = customStdin;
  }

  const { unmount } = render(
    React.createElement(ServiceContainerProvider, {
      children: React.createElement(AppRoot, {
        configPath,
        initialPrompt,
        resume,
        additionalRules,
        additionalPrompts,
      }),
    }),
    renderOptions,
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
