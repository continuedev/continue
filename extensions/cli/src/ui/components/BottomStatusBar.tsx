import { Box, Text } from "ink";
import React from "react";

import type { PermissionMode } from "../../permissions/types.js";
import type { NavigationScreen } from "../context/NavigationContext.js";
import { FreeTrialStatus } from "../FreeTrialStatus.js";
import { UpdateNotification } from "../UpdateNotification.js";

import { ContextPercentageDisplay } from "./ContextPercentageDisplay.js";
import { ModeIndicator } from "./ModeIndicator.js";

interface BottomStatusBarProps {
  currentMode: PermissionMode;
  repoURLText: string;
  isRemoteMode: boolean;
  services: any;
  navState: any;
  navigateTo: (screen: NavigationScreen, data?: any) => void;
  closeCurrentScreen: () => void;
  contextPercentage?: number;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  currentMode,
  repoURLText,
  isRemoteMode,
  services,
  navState,
  navigateTo,
  closeCurrentScreen,
  contextPercentage,
}) => (
  <Box flexDirection="row" justifyContent="space-between" alignItems="center">
    <Box marginLeft={2} flexDirection="row" alignItems="center">
      {currentMode === "normal" && (
        <React.Fragment>
          <Text key="repo-url" color="dim" wrap="truncate-start">
            {repoURLText}
          </Text>
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
            } else if (!shouldShow && navState.currentScreen === "free-trial") {
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
