import { useCallback, useEffect, useState } from "react";

import { getGitBranch, getGitRemoteUrl, isGitRepo } from "../../util/git.js";
import type { ConfigOption, ModelOption } from "../types/selectorTypes.js";

import { useConfigSelector } from "./useConfigSelector.js";
import { useModelSelector } from "./useModelSelector.js";

// Helper function to get repo info for responsive display
export function getRepoInfo(remoteUrl?: string): {
  repoName: string;
  branchName: string | null;
  fullPath: string;
  isGitRepo: boolean;
} {
  let url = remoteUrl ?? "";
  const isGit = isGitRepo();
  let branchName: string | null = null;

  if (!url && isGit) {
    const gitUrl = getGitRemoteUrl();
    if (gitUrl) {
      url = gitUrl;
    }
  }

  if (!url) {
    url = process.cwd();
  }

  // Get branch info if we're in a git repo
  if (isGit) {
    branchName = getGitBranch();
  }

  // Clean up the URL
  const cleanUrl = url
    .replace(/\.git$/, "")
    .replace(/^(https|http):\/\/.*?\//, "");

  return {
    repoName: cleanUrl,
    branchName,
    fullPath: url,
    isGitRepo: isGit,
  };
}

// Helper function to get responsive repo URL text based on available width
export function getResponsiveRepoText(
  remoteUrl?: string,
  availableWidth: number = 0,
): string {
  const repoInfo = getRepoInfo(remoteUrl);

  // If no available width provided, show nothing
  if (availableWidth <= 0) {
    return "";
  }

  // Calculate the minimum space needed for different display options
  const branchSeparator = " ⊦";
  const branchText = repoInfo.branchName || "";
  const repoText = repoInfo.repoName;

  // Priority order for display:
  // 1. repo + branch (if everything fits)
  // 2. branch only (preferred when both fit individually)
  // 3. repo only (fallback when branch doesn't fit)
  // 4. nothing if neither fit

  if (repoInfo.isGitRepo && repoInfo.branchName) {
    const fullText = `${repoText}${branchSeparator}${branchText}`;
    const branchOnlyText = branchText;
    const repoOnlyText = repoText;

    // If full text fits, use it
    if (fullText.length <= availableWidth) {
      return fullText;
    }

    // Prefer branch if it fits (more immediately useful)
    if (branchOnlyText.length <= availableWidth) {
      return branchOnlyText;
    }

    // If branch doesn't fit but repo does, use repo
    if (repoOnlyText.length <= availableWidth) {
      return repoOnlyText;
    }
  }

  // No branch or not in git repo
  if (repoText.length <= availableWidth) {
    return repoText;
  }

  return "";
}

// Helper function to get repo URL text (legacy compatibility)
export function getRepoUrlText(remoteUrl?: string): string {
  return getResponsiveRepoText(remoteUrl);
}

// Custom hook for intro message
export function useIntroMessage(
  isRemoteMode: boolean,
  _services: any,
  _allServicesReady: boolean,
) {
  const [showIntroMessage, setShowIntroMessage] = useState(false);

  useEffect(() => {
    const shouldShow = !isRemoteMode;

    setShowIntroMessage(shouldShow);
  }, [isRemoteMode]);

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

// Custom hook to combine all selector logic
export function useSelectors(
  configPath: string | undefined,
  setChatHistory: React.Dispatch<React.SetStateAction<any[]>>,
  handleClear: () => void,
  setStaticRefreshTrigger?: React.Dispatch<React.SetStateAction<number>>,
): {
  handleConfigSelect: (config: ConfigOption) => Promise<void>;
  handleModelSelect: (model: ModelOption) => Promise<void>;
} {
  const { handleConfigSelect } = useConfigSelector({
    configPath,
    onMessage: (message) => {
      // Convert message to ChatHistoryItem format
      setChatHistory((prev) => [
        ...prev,
        {
          message: { role: message.role, content: message.content },
          contextItems: [],
        },
      ]);
    },
    handleClear,
  });

  const { handleModelSelect } = useModelSelector({
    onMessage: (message) => {
      // Convert message to ChatHistoryItem format
      setChatHistory((prev) => [
        ...prev,
        {
          message: { role: "system", content: message.content },
          contextItems: [],
        },
      ]);
    },
    onRefreshUI: () => {
      // Force a UI refresh to update the IntroMessage with new model
      if (setStaticRefreshTrigger) {
        setStaticRefreshTrigger((prev) => prev + 1);
      }
    },
  });

  return {
    handleConfigSelect,
    handleModelSelect,
  };
}
