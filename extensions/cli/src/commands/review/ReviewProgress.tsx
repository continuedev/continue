import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { LoadingAnimation } from "../../ui/LoadingAnimation.js";

export interface ReviewState {
  name: string;
  status: "pending" | "running" | "pass" | "fail" | "error";
  startTime?: number;
  duration?: number;
}

interface ReviewProgressProps {
  checks: ReviewState[];
  baseBranch?: string;
  changedFileCount?: number;
  loading?: boolean;
}

function StatusIndicator({ status }: { status: ReviewState["status"] }) {
  switch (status) {
    case "pending":
      return <Text dimColor>{"◌ Pending"}</Text>;
    case "running":
      return (
        <Box>
          <LoadingAnimation color="magenta" />
          <Text color="magenta">{" Running"}</Text>
        </Box>
      );
    case "pass":
      return <Text color="green">{"✓ Pass"}</Text>;
    case "fail":
      return <Text color="red">{"✗ Fail"}</Text>;
    case "error":
      return <Text color="red">{"✗ Error"}</Text>;
  }
}

function ElapsedTime({ check }: { check: ReviewState }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (check.status !== "running") return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [check.status]);

  if (check.status === "pending") {
    return <Text dimColor>{"–"}</Text>;
  }

  const seconds =
    check.duration === undefined
      ? check.startTime === undefined
        ? 0
        : Math.round((Date.now() - check.startTime) / 1000)
      : Math.round(check.duration);

  return <Text dimColor>{`${seconds}s`}</Text>;
}

const COL_NAME = 22;
const COL_STATUS = 16;

export const ReviewProgress: React.FC<ReviewProgressProps> = ({
  checks,
  baseBranch,
  changedFileCount,
  loading,
}) => {
  return (
    <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
      <Box gap={1}>
        <Text bold>cn review</Text>
        {baseBranch ? (
          <>
            <Text dimColor>─</Text>
            <Text>
              {checks.length} review{checks.length === 1 ? "" : "s"} against{" "}
              {baseBranch}
            </Text>
            <Text dimColor>─</Text>
            <Text>
              {changedFileCount} changed file
              {changedFileCount === 1 ? "" : "s"}
            </Text>
          </>
        ) : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Box width={COL_NAME}>
            <Text bold dimColor>
              Review
            </Text>
          </Box>
          <Box width={COL_STATUS}>
            <Text bold dimColor>
              Status
            </Text>
          </Box>
          <Text bold dimColor>
            Time
          </Text>
        </Box>

        <Text dimColor>{"─".repeat(COL_NAME + COL_STATUS + 6)}</Text>

        {loading && checks.length === 0 ? (
          <Box>
            <LoadingAnimation color="cyan" />
            <Text dimColor>{" Loading reviews…"}</Text>
          </Box>
        ) : (
          checks.map((check, i) => (
            <Box key={i}>
              <Box width={COL_NAME}>
                <Text>{check.name}</Text>
              </Box>
              <Box width={COL_STATUS}>
                <StatusIndicator status={check.status} />
              </Box>
              <ElapsedTime check={check} />
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
