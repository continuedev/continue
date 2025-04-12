import { ToolCallState } from "core";
import StyledMarkdownPreview from "../../../components/StepContainer/StyledMarkdownPreview/StyledMarkdownPreview";

interface RunTerminalCommandToolCallProps {
  command: string;
  toolCallState: ToolCallState;
}

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  return (
    <StyledMarkdownPreview
      isRenderingInStepContainer
      source={`\`\`\`bash .sh\n${props.command ?? ""}\n\`\`\``}
    />
  );
}
