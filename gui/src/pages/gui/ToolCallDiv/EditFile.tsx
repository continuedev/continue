import { formatCodeblock } from "core/util/formatCodeblock";
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

  const src = formatCodeblock(props.relativeFilePath ?? "", props.changes);

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
