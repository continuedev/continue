import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ToolCall, ToolCallState, ToolStatus } from "core";
import Spinner from "../../../components/markdown/StepContainerPreToolbar/Spinner";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";
import { ThreadDiv } from "./ThreadDiv";

interface ToolCallDivProps {
  toolCall: ToolCall;
  toolCallState: ToolCallState;
}

export function ToolCallDiv(props: ToolCallDivProps) {
  function getIcon(state: ToolStatus) {
    switch (state) {
      case "generating":
      case "calling":
      case "generated":
        return <Spinner />;
      case "done":
        return <CheckIcon className="text-green-500" />;
      case "canceled":
        return <XMarkIcon className="text-red-500" />;
    }
  }

  return (
    <ThreadDiv
      icon={getIcon(props.toolCallState.status)}
      toolCall={props.toolCall}
    >
      <FunctionSpecificToolCallDiv
        toolCall={props.toolCall}
        toolCallState={props.toolCallState}
      />
    </ThreadDiv>
  );
}
