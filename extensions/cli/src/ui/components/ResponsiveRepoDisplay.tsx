import { Text } from "ink";
import React, { useMemo } from "react";

import { useGitBranch } from "../hooks/useGitBranch.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { getResponsiveRepoText } from "../hooks/useTUIChatHooks.js";

interface ResponsiveRepoDisplayProps {
  remoteUrl?: string;
  reservedWidth?: number; // Width reserved for other elements in the same row
}

export const ResponsiveRepoDisplay: React.FC<ResponsiveRepoDisplayProps> = ({
  remoteUrl,
}) => {
  const { columns } = useTerminalSize();
  // Watch for git branch changes with 1 second polling interval
  const currentBranch = useGitBranch(1000);

  const repoText = useMemo(() => {
    // Calculate available width for repo display
    // Reserve space for margins, mode indicator, context percentage, and other UI elements
    const availableWidth = Math.floor(columns / 2);

    return getResponsiveRepoText(remoteUrl, availableWidth);
  }, [remoteUrl, columns, currentBranch]);

  // Don't render if no text to show
  if (!repoText) {
    return null;
  }

  return (
    <Text color="dim" wrap="truncate-start">
      {repoText}
    </Text>
  );
};
