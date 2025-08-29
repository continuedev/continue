import { ContextItem, ToolCallState } from "core";
import { getMarkdownLanguageTagForFile } from "core/util";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";

type EditToolCallProps = {
  showToolCallStatusIcon?: boolean;
  relativeFilePath: string;
  changes: string;
  historyIndex: number;
  toolCallId?: string;
  output?: undefined | ContextItem[];
  status?: ToolCallState["status"];
};

export function EditFile(props: EditToolCallProps) {
  if (!props.relativeFilePath) {
    return null;
  }

  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilePath)} ${props.relativeFilePath}${props.changes ? "\n" + props.changes + "\n" : "\n"}\`\`\``;

  return (
    <StyledMarkdownPreview
      showToolCallStatusIcon={props.showToolCallStatusIcon}
      expandCodeblocks={false}
      isRenderingInStepContainer
      disableManualApply
      source={src}
      toolCallId={props.toolCallId}
      itemIndex={props.historyIndex}
      collapsible={true}
    />
  );
}
