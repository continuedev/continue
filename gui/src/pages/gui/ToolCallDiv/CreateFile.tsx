import { getMarkdownLanguageTagForFile } from "core/util";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";
import { ToolState } from "./types";

interface CreateFileToolCallProps {
  filepath: string;
  fileContents: string;
  state: ToolState;
}

export function CreateFile(props: CreateFileToolCallProps) {
  return (
    <>
      <StyledMarkdownPreview
        isRenderingInStepContainer={true}
        source={`\`\`\`${getMarkdownLanguageTagForFile(props.filepath ?? ".txt")} ${props.filepath}\n${props.fileContents ?? ""}\n\`\`\``}
      />
    </>
  );
}
