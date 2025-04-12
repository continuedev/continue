import { AnyAction, ThunkDispatch } from "@reduxjs/toolkit";
import { ToolCallState } from "core";
import { Fragment } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";
import { continueTerminalCommand } from "../../../redux/thunks/continueTerminalCommand";

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

// Extract status message from terminal output
function parseTerminalOutput(output: string): {
  commandOutput: string;
  statusMessage: string | null;
} {
  // Match status messages like [Command is running...], [Command completed], [Background command failed with...], etc.
  const statusRegex = /\n\[(Command .+?|Background .+?)\]$/;
  const match = output.match(statusRegex);
  
  if (match) {
    return {
      commandOutput: output.replace(statusRegex, ''),
      statusMessage: match[1]
    };
  }
  
  return {
    commandOutput: output,
    statusMessage: null
  };
}

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  const dispatch = useDispatch<ThunkDispatch<any, any, AnyAction>>();
  
  // Find the terminal output from context items if available
  const terminalItem = props.toolCallState.output?.find(
    item => item.name === "Terminal"
  );
  
  const terminalOutput = terminalItem?.content || "";
  const { commandOutput, statusMessage } = parseTerminalOutput(terminalOutput);
  
  const isRunning = props.toolCallState.status === "calling";
  const hasOutput = commandOutput.length > 0;
  
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
          `\n${commandOutput || "Waiting for output..."}` 
          : ""}\n\`\`\``}
      />
      
      {(statusMessage || isRunning) && (
        <CommandStatus>
          <StatusIcon status={statusType} />
          {isRunning ? "Running" : statusMessage}
          {isRunning && props.toolCallId && (
            <BackgroundLink 
              onClick={() => {
                // Dispatch the action to continue the command in the background
                dispatch(continueTerminalCommand({ 
                  toolCallId: props.toolCallId as string
                }));
              }}
            >
              Continue in background
            </BackgroundLink>
          )}
        </CommandStatus>
      )}
    </Fragment>
  );
}
