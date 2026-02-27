import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { subAgentService } from "../../services/SubAgentService.js";
import { LoadingAnimation } from "../LoadingAnimation.js";
import { MarkdownRenderer } from "../MarkdownRenderer.js";

interface SubAgentState {
  agentName: string | undefined;
  content: string;
  isRunning: boolean;
  prompt?: string;
}

export const SubAgentOutput: React.FC = () => {
  const [state, setState] = useState<SubAgentState>({
    agentName: undefined,
    content: "",
    isRunning: false,
  });

  useEffect(() => {
    const onStarted = (data: { agentName: string; prompt: string }) => {
      setState({
        agentName: data.agentName,
        content: "",
        isRunning: true,
        prompt: data.prompt,
      });
    };

    const onContent = (data: { agentName: string; content: string }) => {
      setState((prev) => ({
        ...prev,
        agentName: data.agentName,
        content: data.content,
      }));
    };

    const onCompleted = () => {
      setState((prev) => ({ ...prev, isRunning: false }));
    };

    const onFailed = () => {
      setState((prev) => ({ ...prev, isRunning: false }));
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

  if (!state.isRunning) {
    return null;
  }

  const MAX_OUTPUT_LINES = 15;
  const lines = state.content.split("\n");
  const displayContent =
    lines.length > MAX_OUTPUT_LINES
      ? lines.slice(-MAX_OUTPUT_LINES).join("\n")
      : state.content;
  const hiddenLines =
    lines.length > MAX_OUTPUT_LINES ? lines.length - MAX_OUTPUT_LINES : 0;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <LoadingAnimation color="cyan" visible={true} />
        <Text color="cyan" bold>
          {" "}
          Subagent: {state.agentName || "unknown"}
        </Text>
      </Box>
      {state.content && (
        <Box flexDirection="column" paddingLeft={2}>
          {hiddenLines > 0 && <Text color="dim">... +{hiddenLines} lines</Text>}
          <MarkdownRenderer content={displayContent.trimEnd()} />
        </Box>
      )}
    </Box>
  );
};
