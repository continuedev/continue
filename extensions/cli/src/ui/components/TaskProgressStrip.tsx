import type { TaskPlan } from "core/index.js";
import { formatTaskProgress } from "core/util/taskPlan.js";
import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { getSessionTaskPlan, onTaskPlanChange } from "../../session.js";

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
 * One line above the prompt: "Tasks 3/8 Running migrations". Shown while the
 * session has a task list.
 */
export const TaskProgressStrip: React.FC<{ plan?: TaskPlan }> = ({ plan }) => {
  const live = useTaskPlan();
  const progress = formatTaskProgress(plan ?? live);
  if (!progress) {
    return null;
  }
  return (
    <Box paddingLeft={1}>
      <Text color="dim">Tasks </Text>
      <Text color="cyan" wrap="truncate-end">
        {progress}
      </Text>
    </Box>
  );
};
