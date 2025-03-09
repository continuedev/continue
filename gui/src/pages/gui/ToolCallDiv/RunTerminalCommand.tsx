import { ToolCallState } from "core";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";
import styled from "styled-components";
import { Fragment } from "react";

interface RunTerminalCommandToolCallProps {
  command: string;
  toolCallState: ToolCallState;
}

const OutputContainer = styled.div`
  margin-top: 8px;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
  padding-top: 8px;
`;

const OutputTitle = styled.div`
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
`;

const RunningDot = styled.div`
  width: 8px;
  height: 8px;
  background-color: #4caf50;
  border-radius: 50%;
  margin-left: 6px;
  animation: pulse 1.5s infinite;
  
  @keyframes pulse {
    0% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.4;
    }
  }
`;

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  // Find the terminal output from context items if available
  const terminalOutput = props.toolCallState.output?.find(
    item => item.name === "Terminal"
  )?.content || "";
  
  const isRunning = props.toolCallState.status === "calling";
  const hasOutput = terminalOutput.length > 0;

  return (
    <Fragment>
      <StyledMarkdownPreview
        isRenderingInStepContainer={true}
        source={`\`\`\`bash .sh\n${props.command ?? ""}\n\`\`\``}
      />
      
      {(hasOutput || isRunning) && (
        <OutputContainer>
          <OutputTitle>
            {isRunning ? "Output (running)" : "Output"}
            {isRunning && <RunningDot />}
          </OutputTitle>
          <StyledMarkdownPreview
            isRenderingInStepContainer={true}
            source={`\`\`\`ansi\n${terminalOutput || "Waiting for output..."}\n\`\`\``}
          />
        </OutputContainer>
      )}
    </Fragment>
  );
}
