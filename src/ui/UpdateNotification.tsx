import { Text } from "ink";
import React, { useEffect, useState } from "react";
import { compareVersions, getLatestVersion, getVersion } from "../version.js";

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string>("");
  const [currentVersion] = useState(getVersion());

  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        const latest = await getLatestVersion();
        if (latest) {
          setLatestVersion(latest);
          const comparison = compareVersions(currentVersion, latest);
          setUpdateAvailable(comparison === "older");
        }
      } catch (error) {
        // Silently fail - we don't want to interrupt the user experience
        console.debug("Failed to check for updates:", error);
      }
    };

    // Check for updates but don't block
    checkForUpdate();
  }, [currentVersion]);

  if (!updateAvailable) {
    return null;
  }

  return (
    <Text color="dim">
      Update available: v{latestVersion} (npm i -g @continuedev/cli)
    </Text>
  );
};

export default UpdateNotification;
