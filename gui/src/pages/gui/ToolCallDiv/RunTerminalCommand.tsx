import { ToolCallState } from "core";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";

interface RunTerminalCommandToolCallProps {
  command: string;
  toolCallState: ToolCallState;
}

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  return (
    <StyledMarkdownPreview
      isRenderingInStepContainer={true}
      source={`\`\`\`bash .sh\n${props.command ?? ""}\n\`\`\``}
    />
  );
}
