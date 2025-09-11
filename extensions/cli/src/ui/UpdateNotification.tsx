import { Text } from "ink";
import React, { useEffect, useMemo, useState } from "react";

import { compareVersions, getLatestVersion, getVersion } from "../version.js";

import { useTerminalSize } from "./hooks/useTerminalSize.js";

interface UpdateNotificationProps {
  isRemoteMode?: boolean;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  isRemoteMode = false,
}) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string>("");
  const [currentVersion] = useState(getVersion());
  const { columns } = useTerminalSize();

  useEffect(() => {
    // Skip update check in test environment
    if (process.env.NODE_ENV === "test") {
      return;
    }

    // Skip update check for development versions
    if (currentVersion.endsWith("-dev")) {
      return;
    }

    const abortController = new AbortController();

    const checkForUpdate = async () => {
      try {
        const latest = await getLatestVersion(abortController.signal);
        if (latest) {
          setLatestVersion(latest);
          const comparison = compareVersions(currentVersion, latest);
          setUpdateAvailable(comparison === "older");
        }
      } catch (error) {
        // Silently fail - we don't want to interrupt the user experience
        if (error instanceof Error && error.name !== "AbortError") {
          console.debug("Failed to check for updates:", error);
        }
      }
    };

    // Check for updates but don't block
    checkForUpdate();

    // Cleanup function to abort the request when component unmounts
    return () => {
      abortController.abort();
    };
  }, [currentVersion]);

  const text = useMemo(() => {
    if (columns < 75) {
      return `v${latestVersion} available`;
    }
    return `Update available: v${latestVersion} (npm i -g @continuedev/cli)`;
  }, [columns, latestVersion]);

  if (!updateAvailable) {
    if (isRemoteMode) {
      return <Text color="cyan">◉ Remote Mode</Text>;
    }
    return (
      <Text wrap="truncate-end" color="gray">
        ● Continue CLI
      </Text>
    );
  }

  return <Text color="dim">{text}</Text>;
};

export { UpdateNotification };
