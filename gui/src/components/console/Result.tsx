import { memo } from "react";
import { LLMResult } from "../../hooks/useLLMLog";
import { renderMessage } from "./Message";

interface ResultProps {
  result: LLMResult;
  prevResult: LLMResult | undefined;
}

const Result = memo(function Result({ result, prevResult }: ResultProps) {
  switch (result.kind) {
    case "chunk":
      return <span>{result.chunk}</span>;
      break;
    case "message":
      switch (result.message.role) {
        case "assistant":
        case "thinking":
          const includeRole = !(
            prevResult?.kind === "message" &&
            prevResult.message.role === result.message.role
          );
          return renderMessage(result.message, includeRole);
        default:
          // We don't expect anything but AssistantChatMessages and ThinkingChatMessages in the reply
          // from the LLM output, but log them if they do occur.
          return (
            <div className="border-[color:var(--vscode-panel-border) border-2 border-solid p-1">
              {renderMessage(result.message, true)}
            </div>
          );
      }
      break;
  }
});

export default Result;
