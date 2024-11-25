import { getMarkdownLanguageTagForFile } from "core/util";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";

interface CreateFileToolCallProps {
  filepath: string;
  fileContents: string;
}

export function CreateFile(props: CreateFileToolCallProps) {
  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.filepath ?? "javascript")} ${props.filepath}\n${props.fileContents ?? ""}\n\`\`\``;

  return (
    <>
      <StyledMarkdownPreview isRenderingInStepContainer={true} source={src} />
    </>
  );
}
