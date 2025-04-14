import { getMarkdownLanguageTagForFile } from "core/util";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";

interface CreateFileToolCallProps {
  relativeFilepath: string;
  fileContents: string;
}

export function CreateFile(props: CreateFileToolCallProps) {
  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilepath ?? "output.txt")} ${props.relativeFilepath}\n${props.fileContents ?? ""}\n\`\`\``;

  return props.relativeFilepath ? (
    <StyledMarkdownPreview
      isRenderingInStepContainer
      disableManualApply
      source={src}
    />
  ) : null;
}
