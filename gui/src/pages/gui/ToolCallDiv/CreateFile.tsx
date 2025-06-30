import { formatCodeblock } from "core/util/formatCodeblock";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";

interface CreateFileToolCallProps {
  relativeFilepath: string;
  fileContents: string;
  historyIndex: number;
}

export function CreateFile(props: CreateFileToolCallProps) {
  if (!props.fileContents) {
    return null;
  }

  const src = formatCodeblock(
    props.relativeFilepath ?? "newFile.txt",
    props.fileContents,
  );

  return props.relativeFilepath ? (
    <StyledMarkdownPreview
      isRenderingInStepContainer
      disableManualApply
      source={src}
      itemIndex={props.historyIndex}
    />
  ) : null;
}
