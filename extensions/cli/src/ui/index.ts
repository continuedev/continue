import { render, RenderOptions } from "ink";
import React from "react";

import { PermissionMode } from "../permissions/types.js";
import { initializeServices } from "../services/index.js";
import { ServiceContainerProvider } from "../services/ServiceContainerContext.js";
import { setTUIUnmount } from "../index.js";

import { AppRoot } from "./AppRoot.js";

export { MarkdownRenderer } from "./MarkdownRenderer.js";

interface StartTUIChatOptions {
  initialPrompt?: string;
  resume?: boolean;
  configPath?: string;
  organizationSlug?: string;
  additionalRules?: string[];
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
  const renderOptions: RenderOptions = {
    exitOnCtrlC: false, // Disable Ink's default Ctrl+C handling so we can implement two-stage exit
  };
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
      }),
    }),
    renderOptions,
  );

  // Register unmount function with main process for two-stage Ctrl+C exit
  setTUIUnmount(unmount);

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

  // Register unmount function with main process for two-stage Ctrl+C exit
  setTUIUnmount(unmount);

  return { unmount };
}
