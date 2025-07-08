import { formatCodeblock } from "core/util/formatCodeblock";
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

  const src = formatCodeblock(props.relativeFilePath ?? "", props.changes);

  return (
    <StyledMarkdownPreview
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
