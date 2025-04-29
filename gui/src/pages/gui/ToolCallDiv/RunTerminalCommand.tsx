import { AnyAction, ThunkDispatch } from "@reduxjs/toolkit";
import { ToolCallState } from "core";
import { Fragment } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";
import { moveTerminalProcessToBackground } from "../../../redux/thunks/moveTerminalProcessToBackground";
import { useAppDispatch } from "../../../redux/hooks";

interface RunTerminalCommandToolCallProps {
  command: string;
  toolCallState: ToolCallState;
  toolCallId: string | undefined;
}

const CommandStatus = styled.div`
  font-size: 12px;
  color: #666;
  margin-top: 8px;
  padding-left: 8px;
  padding-right: 8px;
  padding-bottom: 8px;
  display: flex;
  align-items: center;
`;

const StatusIcon = styled.span<{ status: 'running' | 'completed' | 'failed' | 'background' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: ${props =>
    props.status === 'running' ? '#4caf50' :
    props.status === 'completed' ? '#4caf50' :
    props.status === 'background' ? '#2196f3' :
    '#f44336'};
  ${props => props.status === 'running' ? 'animation: pulse 1.5s infinite;' : ''}
`;

// Removed unused styled components

const BackgroundLink = styled.a`
  font-size: 12px;
  color: #0077cc;
  margin-left: 12px;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  const dispatch = useAppDispatch();

  // Find the terminal output from context items if available
  const terminalItem = props.toolCallState.output?.find(
    item => item.name === "Terminal"
  );

  const terminalContent = terminalItem?.content || "";
  const statusMessage = terminalItem?.status || "";
  const isRunning = props.toolCallState.status === "calling";
  const hasOutput = terminalContent.length > 0;

  // Determine status type
  let statusType: 'running' | 'completed' | 'failed' | 'background' = 'completed';
  if (isRunning) {
    statusType = 'running';
  } else if (statusMessage?.includes('failed')) {
    statusType = 'failed';
  } else if (statusMessage?.includes('background')) {
    statusType = 'background';
  }

  return (
    <Fragment>
      <StyledMarkdownPreview
        isRenderingInStepContainer
        source={`\`\`\`bash .sh\n$ ${props.command ?? ""}${(hasOutput || isRunning) ?
          `\n${terminalContent || "Waiting for output..."}`
          : ""}\n\`\`\``}
      />

      {(statusMessage || isRunning) && (
        <CommandStatus>
          <StatusIcon status={statusType} />
          {isRunning ? "Running" : statusMessage}
          {isRunning && props.toolCallId && (
            <BackgroundLink
              onClick={() => {
                // Dispatch the action to move the command to the background
                dispatch(moveTerminalProcessToBackground({
                  toolCallId: props.toolCallId as string
                }));
              }}
            >
              Move to background
            </BackgroundLink>
          )}
        </CommandStatus>
      )}
    </Fragment>
  );
}
