import type { TaskPlan } from "core/index.js";
import { formatTaskProgress } from "core/util/taskPlan.js";
import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import {
  getSessionPlanFile,
  getSessionTaskPlan,
  onTaskPlanChange,
} from "../../session.js";

/** The plan file's name ("add-retry.md"), when the session has one. */
function planFileName(): string | undefined {
  try {
    return getSessionPlanFile()?.split("/").pop();
  } catch {
    return undefined;
  }
}

/** The session's task list, re-rendering when it changes. */
export function useTaskPlan(): TaskPlan | undefined {
  const [plan, setPlan] = useState<TaskPlan | undefined>(() => {
    try {
      return getSessionTaskPlan();
    } catch {
      return undefined;
    }
  });
  useEffect(() => onTaskPlanChange(setPlan), []);
  return plan;
}

/**
 * One line above the prompt: "Tasks 3/8 Running migrations", and the plan
 * file's name when the list came from a plan. Shown while the session has a
 * task list.
 */
export const TaskProgressStrip: React.FC<{ plan?: TaskPlan }> = ({ plan }) => {
  const live = useTaskPlan();
  const progress = formatTaskProgress(plan ?? live);
  if (!progress) {
    return null;
  }
  const planFile = planFileName();
  return (
    <Box paddingLeft={1}>
      <Text color="dim">Tasks </Text>
      <Text color="cyan" wrap="truncate-end">
        {progress}
      </Text>
      {planFile && <Text color="dim"> · plan {planFile}</Text>}
    </Box>
  );
};
