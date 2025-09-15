import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { setExitMessageCallback, shouldShowExitMessage } from "../../index.js";
import type { PermissionMode } from "../../permissions/types.js";
import type { NavigationScreen } from "../context/NavigationContext.js";
import { FreeTrialStatus } from "../FreeTrialStatus.js";
import { UpdateNotification } from "../UpdateNotification.js";

import { ContextPercentageDisplay } from "./ContextPercentageDisplay.js";
import { ModeIndicator } from "./ModeIndicator.js";
import { ResponsiveRepoDisplay } from "./ResponsiveRepoDisplay.js";

export interface BottomStatusBarProps {
  currentMode: PermissionMode;
  remoteUrl?: string;
  isRemoteMode: boolean;
  services: any;
  navState: any;
  navigateTo: (screen: NavigationScreen, data?: any) => void;
  closeCurrentScreen: () => void;
  contextPercentage?: number;
  hasImageInClipboard?: boolean;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  currentMode,
  remoteUrl,
  isRemoteMode,
  services,
  navState,
  navigateTo,
  closeCurrentScreen,
  contextPercentage,
  hasImageInClipboard,
}) => {
  const [_refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setExitMessageCallback(() => {
      setRefreshTrigger((prev) => prev + 1);
    });
  }, []);

  const showingExitMessage = shouldShowExitMessage();

  return (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
      <Box marginLeft={2} flexDirection="row" alignItems="center">
        {currentMode === "normal" && (
          <React.Fragment>
            {hasImageInClipboard ? (
              <Text key="image-paste-hint" color="cyan" wrap="truncate-start">
                Press Ctrl+V to paste image
              </Text>
            ) : showingExitMessage ? (
              <Text key="repo-url" color="dim" wrap="truncate-start">
                {"ctrl+c to exit"}
              </Text>
            ) : (
              <ResponsiveRepoDisplay remoteUrl={remoteUrl} />
            )}
            <Text key="repo-separator"> </Text>
          </React.Fragment>
        )}
        <ModeIndicator />
        {contextPercentage !== undefined && contextPercentage > 75 && (
          <React.Fragment>
            <Text key="context-separator" color="dim">
              {" "}
              •{" "}
            </Text>
            <ContextPercentageDisplay percentage={contextPercentage} />
          </React.Fragment>
        )}
      </Box>
      <Box>
        {!isRemoteMode && services.model?.model && (
          <FreeTrialStatus
            apiClient={services.apiClient?.apiClient || undefined}
            model={services.model.model}
            onTransitionStateChange={(shouldShow) => {
              if (shouldShow && navState.currentScreen === "chat") {
                navigateTo("free-trial");
              } else if (
                !shouldShow &&
                navState.currentScreen === "free-trial"
              ) {
                closeCurrentScreen();
              }
            }}
          />
        )}
      </Box>
      <Box marginRight={2} marginLeft={2}>
        <UpdateNotification isRemoteMode={isRemoteMode} />
      </Box>
    </Box>
  );
};
