import { getMarkdownLanguageTagForFile } from "core/util";
import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";

type EditToolCallProps = {
  relativeFilePath: string;
  newContents: string;
};

export function EditFile(props: EditToolCallProps) {
  const src = `\`\`\`${getMarkdownLanguageTagForFile(props.relativeFilePath ?? "test.txt")} ${props.relativeFilePath}\n${props.newContents ?? ""}\n\`\`\``;

  return props.relativeFilePath ? (
    <StyledMarkdownPreview
      isRenderingInStepContainer={true}
      source={src}
      autoApplyCodeblocks={true}
      hideApply={true}
    />
  ) : null;
}
