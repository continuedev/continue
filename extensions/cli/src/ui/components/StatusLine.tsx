import { Box, Text } from "ink";
import React from "react";

import type { PermissionMode } from "../../permissions/types.js";
import type { ProgressTrackerState } from "../../services/ProgressTrackerService.js";
import type { TaskNotificationServiceState } from "../../services/TaskNotificationService.js";
import type { TaskStateServiceState } from "../../services/TaskStateService.js";

import { ResponsiveRepoDisplay } from "./ResponsiveRepoDisplay.js";

interface StatusLineProps {
  remoteUrl?: string;
  currentMode: PermissionMode;
  modelLabel?: string;
  contextPercentage?: number;
  taskState?: TaskStateServiceState;
  progressTracker?: ProgressTrackerState;
  taskNotifications?: TaskNotificationServiceState;
  totalCost?: number;
  isVerboseMode?: boolean;
}

function formatCompactNumber(value: number | undefined): string | null {
  if (!value || value <= 0) {
    return null;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return String(value);
}

function taskStatusColor(status?: string): string {
  switch (status) {
    case "completed":
      return "green";
    case "failed":
    case "killed":
      return "red";
    case "running":
      return "yellow";
    default:
      return "cyan";
  }
}

function getLatestTaskSummary(
  taskState?: TaskStateServiceState,
  taskNotifications?: TaskNotificationServiceState,
): { status?: string; summary: string } | null {
  const currentTask = taskState?.currentTask;
  if (currentTask) {
    return {
      status: currentTask.status,
      summary: currentTask.description,
    };
  }

  const latestNotification = taskNotifications?.notifications?.at(-1);
  if (latestNotification) {
    return {
      status: latestNotification.status,
      summary: latestNotification.summary,
    };
  }

  const lastTask = taskState?.taskHistory?.at(-1);
  if (lastTask) {
    return {
      status: lastTask.status,
      summary: lastTask.description,
    };
  }

  return null;
}

export const StatusLine: React.FC<StatusLineProps> = ({
  remoteUrl,
  currentMode,
  modelLabel,
  contextPercentage,
  taskState,
  progressTracker,
  taskNotifications,
  totalCost,
  isVerboseMode,
}) => {
  const latestTask = getLatestTaskSummary(taskState, taskNotifications);
  const totalTokens = progressTracker
    ? progressTracker.latestInputTokens + progressTracker.cumulativeOutputTokens
    : 0;

  return (
    <Box flexDirection="row" alignItems="center" gap={1} width="100%">
      <ResponsiveRepoDisplay remoteUrl={remoteUrl} />
      <Text color="dim">|</Text>
      <Text color="cyan">mode {currentMode}</Text>
      {modelLabel && (
        <React.Fragment>
          <Text color="dim">|</Text>
          <Text color="blue">{modelLabel}</Text>
        </React.Fragment>
      )}
      {contextPercentage !== undefined && contextPercentage > 0 && (
        <React.Fragment>
          <Text color="dim">|</Text>
          <Text color={contextPercentage >= 80 ? "yellow" : "green"}>
            ctx {Math.round(contextPercentage)}%
          </Text>
        </React.Fragment>
      )}
      {progressTracker && progressTracker.totalToolCalls > 0 && (
        <React.Fragment>
          <Text color="dim">|</Text>
          <Text color="magenta">tools {progressTracker.totalToolCalls}</Text>
        </React.Fragment>
      )}
      {totalTokens > 0 && (
        <React.Fragment>
          <Text color="dim">|</Text>
          <Text color="dim">tok {formatCompactNumber(totalTokens)}</Text>
        </React.Fragment>
      )}
      {isVerboseMode && totalCost !== undefined && totalCost > 0 && (
        <React.Fragment>
          <Text color="dim">|</Text>
          <Text color="dim">${totalCost.toFixed(4)}</Text>
        </React.Fragment>
      )}
      {latestTask && (
        <React.Fragment>
          <Text color="dim">|</Text>
          <Text color={taskStatusColor(latestTask.status)} wrap="truncate-end">
            {latestTask.summary}
          </Text>
        </React.Fragment>
      )}
    </Box>
  );
};
