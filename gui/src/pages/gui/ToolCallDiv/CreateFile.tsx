interface CreateFileToolCallProps {
  filepath: string;
  fileContents: string;
}

export function CreateFile(props: CreateFileToolCallProps) {
  return (
    <>
      {props.fileContents}
      {/* <StyledMarkdownPreview
        isRenderingInStepContainer={true}
        source={`\`\`\`${getMarkdownLanguageTagForFile(props.filepath ?? ".txt")} ${props.filepath}\n${props.fileContents ?? ""}\n\`\`\``}
      /> */}
    </>
  );
}
