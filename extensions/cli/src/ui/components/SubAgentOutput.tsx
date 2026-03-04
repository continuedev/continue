import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { subAgentService } from "../../services/SubAgentService.js";
import { LoadingAnimation } from "../LoadingAnimation.js";
import { MarkdownRenderer } from "../MarkdownRenderer.js";

interface SubAgentState {
  agentName: string;
  contentLines: string[];
}

export const SubAgentOutput: React.FC = () => {
  const [agents, setAgents] = useState<Record<string, SubAgentState>>({});

  useEffect(() => {
    const onStarted = (data: { executionId: string; agentName: string }) => {
      setAgents((prev) => ({
        ...prev,
        [data.executionId]: {
          agentName: data.agentName,
          contentLines: [],
        },
      }));
    };

    const onContent = (data: {
      executionId: string;
      agentName: string;
      content: string;
      type: "content" | "toolResult";
    }) => {
      setAgents((prev) => {
        const agent = prev[data.executionId];
        if (!agent) return prev;

        const newLines = data.content.split("\n");
        let updatedLines: string[];

        if (data.type === "toolResult") {
          updatedLines = [...agent.contentLines, "", ...newLines];
        } else if (agent.contentLines.length === 0) {
          updatedLines = newLines;
        } else {
          const lastLine = agent.contentLines[agent.contentLines.length - 1];
          updatedLines = [
            ...agent.contentLines.slice(0, -1),
            lastLine + newLines[0],
            ...newLines.slice(1),
          ];
        }

        return {
          ...prev,
          [data.executionId]: {
            ...agent,
            contentLines: updatedLines,
          },
        };
      });
    };

    const onCompleted = (data: { executionId: string }) => {
      setAgents((prev) => {
        const { [data.executionId]: _, ...rest } = prev;
        return rest;
      });
    };

    const onFailed = (data: { executionId: string }) => {
      setAgents((prev) => {
        const { [data.executionId]: _, ...rest } = prev;
        return rest;
      });
    };

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

  const agentEntries = Object.entries(agents);

  if (agentEntries.length === 0) {
    return null;
  }

  const MAX_OUTPUT_LINES = 15;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {agentEntries.map(([executionId, agent]) => {
        const displayContent =
          agent.contentLines.length > MAX_OUTPUT_LINES
            ? agent.contentLines.slice(-MAX_OUTPUT_LINES).join("\n")
            : agent.contentLines.join("\n");
        const hiddenLines =
          agent.contentLines.length > MAX_OUTPUT_LINES
            ? agent.contentLines.length - MAX_OUTPUT_LINES
            : 0;

        return (
          <Box key={executionId} flexDirection="column" marginBottom={1}>
            <Box marginBottom={agent.contentLines.length > 0 ? 1 : 0}>
              <LoadingAnimation color="cyan" visible={true} />
              <Text color="cyan" bold>
                {" "}
                Subagent: {agent.agentName || "unknown"}
              </Text>
            </Box>
            {agent.contentLines.length > 0 && (
              <Box flexDirection="column" paddingLeft={2}>
                {hiddenLines > 0 && (
                  <Text color="dim">... +{hiddenLines} lines</Text>
                )}
                <MarkdownRenderer content={displayContent.trimEnd()} />
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
