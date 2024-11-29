import StyledMarkdownPreview from "../../../components/markdown/StyledMarkdownPreview";

interface ExactSearchToolCallProps {
  query: string;
}

export function ExactSearch(props: ExactSearchToolCallProps) {
  return (
    <StyledMarkdownPreview
      isRenderingInStepContainer={true}
      source={`Searching for "\`${props.query}\`"`}
    />
  );
}
