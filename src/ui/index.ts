import { PermissionMode } from "../permissions/types.js";
import { initializeServices } from "../services/index.js";

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

  // Dynamically import Ink and React only when we need them
  const [{ render }, React, { ServiceContainerProvider }, { AppRoot }] =
    await Promise.all([
      import("ink"),
      import("react"),
      import("../services/ServiceContainerContext.js"),
      import("./AppRoot.js"),
    ]);

  // Start the TUI immediately - it will handle loading states
  const renderOptions: any = {};
  if (customStdin) {
    renderOptions.stdin = customStdin;
  }

  let unmount: () => void;
  try {
    const result = render(
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
    unmount = result.unmount;
  } catch (error) {
    // If TUI fails to start (e.g., TTY issues), throw a clear error
    throw new Error(
      `TUI initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

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
  // Dynamically import Ink and React only when we need them
  const [{ render }, React, { ServiceContainerProvider }, { AppRoot }] =
    await Promise.all([
      import("ink"),
      import("react"),
      import("../services/ServiceContainerContext.js"),
      import("./AppRoot.js"),
    ]);

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
