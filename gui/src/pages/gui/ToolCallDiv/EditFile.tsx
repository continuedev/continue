import { getMarkdownLanguageTagForFile } from "core/util";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";

type EditToolCallProps = {
  relativeFilePath: string;
  changes: string;
  historyIndex: number;
  toolCallId?: string;
  expandCodeblocks?: boolean;
};

export function EditFile(props: EditToolCallProps) {
  if (!props.relativeFilePath || !props.changes) {
    return null;
  }

  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilePath ?? "test.txt")} ${props.relativeFilePath}\n${props.changes}\n\`\`\``;

  return (
    <StyledMarkdownPreview
      expandCodeblocks={props.expandCodeblocks ?? false}
      isRenderingInStepContainer
      disableManualApply
      source={src}
      toolCallId={props.toolCallId}
      itemIndex={props.historyIndex}
    />
  );
}
