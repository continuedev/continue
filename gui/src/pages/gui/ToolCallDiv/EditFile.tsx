import { getMarkdownLanguageTagForFile } from "core/util";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";

type EditToolCallProps = {
  relativeFilePath: string;
  changes: string;
  toolCallId?: string;
  historyIndex: number;
};

export function EditFile(props: EditToolCallProps) {
  if (!props.relativeFilePath || !props.changes) {
    return null;
  }

  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilePath ?? "test.txt")} ${props.relativeFilePath}\n${props.changes}\n\`\`\``;

  return (
    <StyledMarkdownPreview
      isRenderingInStepContainer
      disableManualApply
      source={src}
      toolCallId={props.toolCallId}
      expandCodeblocks={false}
      itemIndex={props.historyIndex}
    />
  );
}
