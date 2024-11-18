import StepContainerPreToolbar from "../../../components/markdown/StepContainerPreToolbar";
import { SyntaxHighlightedPre } from "../../../components/markdown/SyntaxHighlightedPre";
import { ToolState } from "./types";

interface RunTerminalCommandToolCallProps {
  command: string;
  state: ToolState;
}

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  return (
    <>
      <p>Continue wants to run a terminal command:</p>

      <StepContainerPreToolbar
        codeBlockContent={props.command ?? ""}
        codeBlockIndex={0}
        language={"bash"}
        filepath={"bash"}
        isGeneratingCodeBlock={false}
        expanded={false}
        hideApply={true}
      >
        <SyntaxHighlightedPre>
          <span></span>
          {props.command}
        </SyntaxHighlightedPre>
      </StepContainerPreToolbar>
    </>
  );
}
