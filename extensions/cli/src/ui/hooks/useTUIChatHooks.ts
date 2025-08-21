import { useCallback, useEffect, useState } from "react";

import type { PermissionMode } from "../../permissions/types.js";
import { modeService } from "../../services/ModeService.js";
import { getGitRemoteUrl, isGitRepo } from "../../util/git.js";
import type { ConfigOption, ModelOption } from "../types/selectorTypes.js";

import { useConfigSelector } from "./useConfigSelector.js";
import { useModelSelector } from "./useModelSelector.js";

// Helper function to get repo URL text
export function getRepoUrlText(remoteUrl?: string): string {
  let url = remoteUrl ?? "";
  if (!url) {
    const isGit = isGitRepo();
    if (isGit) {
      const gitUrl = getGitRemoteUrl();
      if (gitUrl) {
        url = gitUrl;
      }
    }
  }
  if (!url) {
    url = process.cwd();
  }

  url = url.replace(/\.git$/, "");
  url = url.replace(/^(https|http):\/\/.*?\//, "");
  return url;
}

// Custom hook for intro message
export function useIntroMessage(
  isRemoteMode: boolean,
  services: any,
  allServicesReady: boolean,
) {
  const [showIntroMessage, setShowIntroMessage] = useState(false);

  useEffect(() => {
    const shouldShow =
      !isRemoteMode &&
      allServicesReady &&
      !!services.config?.config &&
      !!services.model?.model &&
      !!services.mcp?.mcpService;

    setShowIntroMessage(shouldShow);
  }, [
    isRemoteMode,
    allServicesReady,
    services.config?.config,
    services.model?.model,
    services.mcp?.mcpService,
  ]);

  return [showIntroMessage, setShowIntroMessage] as const;
}

// Custom hook for login handling
export function useLoginHandlers(
  navigateTo: any,
  navState: any,
  closeCurrentScreen: () => void,
) {
  const handleLoginPrompt = useCallback(
    (promptText: string): Promise<string> => {
      return new Promise((resolve) => {
        navigateTo("login", { text: promptText, resolve });
      });
    },
    [navigateTo],
  );

  const handleLoginTokenSubmit = useCallback(
    (token: string) => {
      if (navState.screenData?.resolve) {
        navState.screenData.resolve(token);
        closeCurrentScreen();
      }
    },
    [navState.screenData, closeCurrentScreen],
  );

  return { handleLoginPrompt, handleLoginTokenSubmit };
}

// Custom hook for mode tracking
export function useCurrentMode() {
  const [currentMode, setCurrentMode] = useState<PermissionMode>(
    modeService.getCurrentMode(),
  );

  useEffect(() => {
    const handleModeChange = (newMode: PermissionMode) => {
      setCurrentMode(newMode);
    };

    modeService.on("modeChanged", handleModeChange);
    return () => {
      modeService.off("modeChanged", handleModeChange);
    };
  }, []);

  return currentMode;
}

// Custom hook to combine all selector logic
export function useSelectors(
  configPath: string | undefined,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  resetChatHistory: () => void,
): {
  handleConfigSelect: (config: ConfigOption) => Promise<void>;
  handleModelSelect: (model: ModelOption) => Promise<void>;
} {
  const { handleConfigSelect } = useConfigSelector({
    configPath,
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
    onChatReset: resetChatHistory,
  });

  const { handleModelSelect } = useModelSelector({
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
  });

  return {
    handleConfigSelect,
    handleModelSelect,
  };
}
