import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { subAgentService } from "../../services/SubAgentService.js";
import { LoadingAnimation } from "../LoadingAnimation.js";
import { MarkdownRenderer } from "../MarkdownRenderer.js";

export const SubAgentOutput: React.FC = () => {
  const [agentName, setAgentName] = useState<string | undefined>(undefined);
  const [contentLines, setContentLines] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const onStarted = (data: { agentName: string }) => {
      setAgentName(data.agentName);
      setContentLines([]);
      setIsRunning(true);
    };

    const onContent = (data: {
      agentName: string;
      content: string;
      type: "content" | "toolResult";
    }) => {
      setAgentName(data.agentName);
      setContentLines((prev) => {
        const newLines = data.content.split("\n");
        if (data.type === "toolResult") {
          return [...prev, "", ...newLines];
        }
        if (prev.length === 0) {
          return newLines;
        }
        const lastLine = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          lastLine + newLines[0],
          ...newLines.slice(1),
        ];
      });
    };

    const onCompleted = () => setIsRunning(false);
    const onFailed = () => setIsRunning(false);

    subAgentService.on("subagentStarted", onStarted);
    subAgentService.on("subagentContent", onContent);
    subAgentService.on("subagentCompleted", onCompleted);
    subAgentService.on("subagentFailed", onFailed);

    return () => {
      subAgentService.off("subagentStarted", onStarted);
      subAgentService.off("subagentContent", onContent);
      subAgentService.off("subagentCompleted", onCompleted);
      subAgentService.off("subagentFailed", onFailed);
    };
  }, []);

  if (!isRunning) {
    return null;
  }

  const MAX_OUTPUT_LINES = 15;
  const displayContent =
    contentLines.length > MAX_OUTPUT_LINES
      ? contentLines.slice(-MAX_OUTPUT_LINES).join("\n")
      : contentLines.join("\n");
  const hiddenLines =
    contentLines.length > MAX_OUTPUT_LINES
      ? contentLines.length - MAX_OUTPUT_LINES
      : 0;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <LoadingAnimation color="cyan" visible={true} />
        <Text color="cyan" bold>
          {" "}
          Subagent: {agentName || "unknown"}
        </Text>
      </Box>
      {contentLines.length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {hiddenLines > 0 && <Text color="dim">... +{hiddenLines} lines</Text>}
          <MarkdownRenderer content={displayContent.trimEnd()} />
        </Box>
      )}
    </Box>
  );
};
