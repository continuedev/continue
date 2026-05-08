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
import { StatusLine } from "./StatusLine.js";

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
  isVerboseMode?: boolean;
  totalCost?: number;
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
  isVerboseMode,
  totalCost,
}) => {
  const [_refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setExitMessageCallback(() => {
      setRefreshTrigger((prev) => prev + 1);
    });
  }, []);

  const showingExitMessage = shouldShowExitMessage();
  const statusLineEnabled =
    services.featureFlags?.flags?.CLI_STATUSLINE ?? false;
  const modelLabel =
    services.model?.model?.title ??
    services.model?.model?.name ??
    services.model?.model?.model ??
    undefined;

  return (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
      <Box marginLeft={2} flexDirection="row" alignItems="center">
        {hasImageInClipboard ? (
          <Text key="image-paste-hint" color="cyan" wrap="truncate-start">
            Press Ctrl+V to paste image
          </Text>
        ) : showingExitMessage ? (
          <Text key="repo-url" color="dim" wrap="truncate-start">
            {"ctrl+c to exit"}
          </Text>
        ) : statusLineEnabled ? (
          <StatusLine
            remoteUrl={remoteUrl}
            currentMode={currentMode}
            modelLabel={modelLabel}
            contextPercentage={contextPercentage}
            taskState={services.taskState}
            progressTracker={services.progressTracker}
            taskNotifications={services.taskNotifications}
            totalCost={totalCost}
            isVerboseMode={isVerboseMode}
          />
        ) : (
          <React.Fragment>
            {currentMode === "normal" && (
              <React.Fragment>
                <ResponsiveRepoDisplay remoteUrl={remoteUrl} />
                <Text key="repo-separator"> </Text>
              </React.Fragment>
            )}
            <ModeIndicator />
            {contextPercentage !== undefined && contextPercentage > 0 && (
              <React.Fragment>
                <Text key="context-separator" color="dim">
                  {" "}
                  •{" "}
                </Text>
                <ContextPercentageDisplay percentage={contextPercentage} />
              </React.Fragment>
            )}
            {isVerboseMode && totalCost !== undefined && totalCost > 0 && (
              <React.Fragment>
                <Text key="cost-separator" color="dim">
                  {" "}
                  •{" "}
                </Text>
                <Text key="cost-display" color="dim">
                  Cost: ${totalCost.toFixed(4)}
                </Text>
              </React.Fragment>
            )}
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
