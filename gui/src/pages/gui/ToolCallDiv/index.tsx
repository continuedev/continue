import { CheckIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ToolCall, ToolStatus } from "core";
import { incrementalParseJson } from "core/util/incrementalParseJson";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { lightGray } from "../../../components";
import Spinner from "../../../components/markdown/StepContainerPreToolbar/Spinner";
import { setGeneratedOutput } from "../../../redux/slices/stateSlice";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";
import { ThreadDiv } from "./ThreadDiv";

interface ToolCallDivProps {
  toolCall: ToolCall;
  status: ToolStatus;
}

export function ToolCallDiv(props: ToolCallDivProps) {
  const dispatch = useDispatch();

  useEffect(() => {
    // Once the JSON can successfully parse, then set state to "generated"
    if (props.toolCall.function.arguments.length === 0) {
      dispatch(setGeneratedOutput(props.toolCall));
      return;
    }

    const [done, j] = incrementalParseJson(props.toolCall.function.arguments);
    if (done) {
      dispatch(setGeneratedOutput(props.toolCall));
    }
  }, [props.toolCall.function.arguments]);

  function getIcon(state: ToolStatus) {
    console.log("State: ", state);

    switch (state) {
      case "generating":
        return <Spinner />;
      case "done":
        return <CheckIcon className="text-green-500" />;
      case "calling":
        return <Spinner />;
      case "canceled":
        return <XMarkIcon className="text-red-500" />;
      case "generated":
        return <PlayIcon color={lightGray} />;
    }
  }

  return (
    <ThreadDiv icon={getIcon(props.status)} toolCall={props.toolCall}>
      {props.status}
      <FunctionSpecificToolCallDiv toolCall={props.toolCall} />
    </ThreadDiv>
  );
}
