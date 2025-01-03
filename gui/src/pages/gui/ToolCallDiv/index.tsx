import {
  ArrowRightIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ToolCall, ToolCallDelta, ToolCallState, ToolStatus } from "core";
import { vscButtonBackground } from "../../../components";
import Spinner from "../../../components/gui/Spinner";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";
import { ThreadDiv } from "./ThreadDiv";

interface ToolCallDivProps {
  toolCall: ToolCallDelta;
  toolCallState: ToolCallState;
}

export function ToolCallDiv(props: ToolCallDivProps) {
  function getIcon(state: ToolStatus) {
    switch (state) {
      case "generating":
      case "calling":
        return <Spinner />;
      case "generated":
        return <ArrowRightIcon color={vscButtonBackground} />;
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
      toolCallState={props.toolCallState}
    >
      <FunctionSpecificToolCallDiv
        toolCall={props.toolCall}
        toolCallState={props.toolCallState}
      />
    </ThreadDiv>
  );
}
