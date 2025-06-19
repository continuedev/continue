import { ToolCallState } from "core";
import styled from "styled-components";
import { vscForeground } from "../../../components";
import Ansi from "../../../components/ansiTerminal/Ansi";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";
import { useAppDispatch } from "../../../redux/hooks";
import { moveTerminalProcessToBackground } from "../../../redux/thunks/moveTerminalProcessToBackground";

interface RunTerminalCommandToolCallProps {
  command: string;
  toolCallState: ToolCallState;
  toolCallId: string | undefined;
}

const CommandStatus = styled.div`
  font-size: 12px;
  color: var(--vscode-descriptionForeground, ${vscForeground}88);
  margin-top: 8px;
  display: flex;
  align-items: center;
  padding-left: 8px;
  padding-right: 8px;
`;

const StatusIcon = styled.span<{
  status: "running" | "completed" | "failed" | "background";
}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: ${(props) =>
    props.status === "running"
      ? "var(--vscode-testing-runAction, #4caf50)"
      : props.status === "completed"
        ? "var(--vscode-testing-iconPassed, #4caf50)"
        : props.status === "background"
          ? "var(--vscode-statusBarItem-prominentBackground, #2196f3)"
          : "var(--vscode-testing-iconFailed, #f44336)"};
  ${(props) =>
    props.status === "running" ? "animation: pulse 1.5s infinite;" : ""}
`;

// Waiting message styled for consistency
const WaitingMessage = styled.div`
  padding: 8px;
  padding-left: 16px;
  padding-right: 16px;
  margin-top: 8px;
`;

// For consistency with the rest of the styled components
const AnsiWrapper = styled.div`
  margin-top: 8px;
`;

const BackgroundLink = styled.a`
  font-size: 12px;
  color: var(--vscode-textLink-foreground, #3794ff);
  margin-left: 12px;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

// Just spacing between terminal components and the next toolcall
const TerminalContainer = styled.div`
  margin-bottom: 16px;
`;

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  const dispatch = useAppDispatch();

  // Find the terminal output from context items if available
  const terminalItem = props.toolCallState.output?.find(
    (item) => item.name === "Terminal",
  );

  const terminalContent = terminalItem?.content || "";
  const statusMessage = terminalItem?.status || "";
  const isRunning = props.toolCallState.status === "calling";
  const hasOutput = terminalContent.length > 0;

  // Determine status type
  let statusType: "running" | "completed" | "failed" | "background" =
    "completed";
  if (isRunning) {
    statusType = "running";
  } else if (statusMessage?.includes("failed")) {
    statusType = "failed";
  } else if (statusMessage?.includes("background")) {
    statusType = "background";
  }

  return (
    <TerminalContainer>
      {/* Command */}
      <StyledMarkdownPreview
        isRenderingInStepContainer
        source={`\`\`\`bash .sh\n$ ${props.command ?? ""}\n\`\`\``}
      />

      {/* Terminal output with ANSI support */}
      {isRunning && !hasOutput && (
        <WaitingMessage>Waiting for output...</WaitingMessage>
      )}
      {hasOutput && (
        <AnsiWrapper>
          <Ansi>{terminalContent}</Ansi>
        </AnsiWrapper>
      )}

      {/* Status information */}
      {(statusMessage || isRunning) && (
        <CommandStatus>
          <StatusIcon status={statusType} />
          {isRunning ? "Running" : statusMessage}
          {isRunning && props.toolCallId && (
            <BackgroundLink
              onClick={() => {
                // Dispatch the action to move the command to the background
                dispatch(
                  moveTerminalProcessToBackground({
                    toolCallId: props.toolCallId as string,
                  }),
                );
              }}
            >
              Move to background
            </BackgroundLink>
          )}
        </CommandStatus>
      )}
    </TerminalContainer>
  );
}
