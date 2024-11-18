import StepContainerPreToolbar from "../../../components/markdown/StepContainerPreToolbar";
import { SyntaxHighlightedPre } from "../../../components/markdown/SyntaxHighlightedPre";

interface CreateFileToolCallProps {
  filepath: string;
  fileContents: string;
}

export function CreateFile(props: CreateFileToolCallProps) {
  return (
    <>
      <p>Continue wants to create a file:</p>
      <StepContainerPreToolbar
        codeBlockContent={props.fileContents ?? "abc"}
        codeBlockIndex={0}
        language={"javascript"}
        filepath={props.filepath ?? "test.js"}
        isGeneratingCodeBlock={false}
        expanded={false}
        hideApply={true}
      >
        <SyntaxHighlightedPre>
          <span></span>
          {props.fileContents}
        </SyntaxHighlightedPre>
      </StepContainerPreToolbar>
    </>
  );
}
