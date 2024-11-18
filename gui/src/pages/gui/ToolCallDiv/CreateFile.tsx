import StepContainerPreToolbar from "../../../components/markdown/StepContainerPreToolbar";
import { SyntaxHighlightedPre } from "../../../components/markdown/SyntaxHighlightedPre";
import { ToolState } from "./types";

interface CreateFileToolCallProps {
  filepath: string;
  fileContents: string;
  state: ToolState;
}

export function CreateFile(props: CreateFileToolCallProps) {
  return (
    <>
      <StepContainerPreToolbar
        codeBlockContent={props.fileContents ?? "New File"}
        codeBlockIndex={0}
        language={"javascript"}
        filepath={props.filepath ?? "Loading"}
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
