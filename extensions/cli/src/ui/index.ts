import { render, RenderOptions } from "ink";
import React from "react";

import { enableSigintHandler, setTUIUnmount } from "../index.js";
import { PermissionMode } from "../permissions/types.js";
import { initializeServices } from "../services/index.js";
import { ServiceContainerProvider } from "../services/ServiceContainerContext.js";
import { isHeadlessMode, isTTYless } from "../util/cli.js";
import { logger } from "../util/logger.js";

import { AppRoot } from "./AppRoot.js";

export { MarkdownRenderer } from "./MarkdownRenderer.js";

interface StartTUIChatOptions {
  initialPrompt?: string;
  resume?: boolean;
  fork?: string;
  config?: string;
  org?: string;
  rule?: string[];
  prompt?: string[];
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
    fork,
    config,
    org,
    rule,
    prompt,
    toolPermissionOverrides,
    skipOnboarding,
    customStdin,
  } = options;

  // Critical safeguard: Prevent TUI initialization in headless mode
  if (isHeadlessMode()) {
    throw new Error(
      "Cannot start TUI in headless mode. This is a programming error - " +
        "startTUIChat should not be called when -p/--print flag is used.",
    );
  }

  // Critical safeguard: Prevent TUI initialization in TTY-less environment
  if (isTTYless() && !customStdin) {
    throw new Error(
      "Cannot start TUI in TTY-less environment. No TTY available for interactive mode.\n" +
        "For non-interactive use, run with -p flag:\n" +
        '  cn -p "your prompt here"',
    );
  }

  // Initialize services only if not already done (skipOnboarding means already initialized)
  if (!skipOnboarding) {
    await initializeServices({
      options: { config, org, rule, prompt },
      headless: false,
      toolPermissionOverrides,
    });
  }

  // Validate stdin is available and suitable for Ink
  const stdinToUse = customStdin || process.stdin;

  // Test raw mode capability (required by Ink)
  if (
    stdinToUse.isTTY &&
    typeof (stdinToUse as any).setRawMode === "function"
  ) {
    try {
      // Test that we can enter raw mode (Ink requirement)
      (stdinToUse as any).setRawMode(true);
      (stdinToUse as any).setRawMode(false);
      logger.debug("Raw mode test passed - TTY is suitable for Ink");
    } catch {
      throw new Error(
        "Terminal does not support raw mode required for interactive UI.\n" +
          'Use -p flag for headless mode: cn -p "your prompt"',
      );
    }
  } else if (!customStdin) {
    logger.warn("stdin is not a TTY or does not support setRawMode");
  }

  // Start the TUI immediately - it will handle loading states
  const renderOptions: RenderOptions = {
    exitOnCtrlC: false, // Disable Ink's default Ctrl+C handling so we can implement two-stage exit
    stdin: stdinToUse,
    stdout: process.stdout,
    stderr: process.stderr,
  };

  const { unmount } = render(
    React.createElement(ServiceContainerProvider, {
      children: React.createElement(AppRoot, {
        configPath: config,
        initialPrompt,
        resume,
        fork,
        additionalRules: rule,
        additionalPrompts: prompt,
      }),
    }),
    renderOptions,
  );

  // Register unmount function with main process for two-stage Ctrl+C exit
  setTUIUnmount(unmount);

  // Enable the two-stage SIGINT handler for TUI mode
  enableSigintHandler();

  return { unmount };
}

export async function startRemoteTUIChat(
  remoteUrl: string,
  initialPrompt?: string,
) {
  // Critical safeguard: Prevent TUI initialization in TTY-less environment
  if (isTTYless()) {
    throw new Error(
      "Cannot start remote TUI in TTY-less environment. No TTY available for interactive mode.",
    );
  }

  // Test raw mode capability for remote TUI
  if (
    process.stdin.isTTY &&
    typeof (process.stdin as any).setRawMode === "function"
  ) {
    try {
      (process.stdin as any).setRawMode(true);
      (process.stdin as any).setRawMode(false);
      logger.debug("Raw mode test passed for remote TUI");
    } catch {
      throw new Error(
        "Terminal does not support raw mode required for interactive UI.",
      );
    }
  }

  // Start the TUI in remote mode - no services needed
  const { unmount } = render(
    React.createElement(ServiceContainerProvider, {
      children: React.createElement(AppRoot, {
        remoteUrl,
        initialPrompt,
      }),
    }),
    {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
    },
  );

  // Register unmount function with main process for two-stage Ctrl+C exit
  setTUIUnmount(unmount);

  return { unmount };
}
