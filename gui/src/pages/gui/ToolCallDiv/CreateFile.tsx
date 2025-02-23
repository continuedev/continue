import { getMarkdownLanguageTagForFile } from "core/util";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";

interface CreateFileToolCallProps {
  relativeFilepath: string;
  fileContents: string;
}

export function CreateFile(props: CreateFileToolCallProps) {
  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilepath ?? "test.txt")} ${props.relativeFilepath}\n${props.fileContents ?? ""}\n\`\`\``;

  return props.relativeFilepath ? (
    <StyledMarkdownPreview isRenderingInStepContainer={true} source={src} />
  ) : null;
}
