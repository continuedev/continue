import { CheckIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ToolCall } from "core";
import { incrementalParseJson } from "core/util/incrementalParseJson";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { lightGray } from "../../../components";
import Spinner from "../../../components/markdown/StepContainerPreToolbar/Spinner";
import {
  registerCurrentToolCall,
  setGeneratedOutput,
} from "../../../redux/slices/toolCallSlice";
import { RootState } from "../../../redux/store";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";
import { ThreadDiv } from "./ThreadDiv";
import { ToolState } from "./types";

interface ToolCallDivProps {
  toolCall: ToolCall;
}

export function ToolCallDiv(props: ToolCallDivProps) {
  const dispatch = useDispatch();
  const toolCallState = useSelector((store: RootState) => store.toolCallState);

  useEffect(() => {
    dispatch(registerCurrentToolCall());
  }, []);

  useEffect(() => {
    // Once the JSON can successfully parse, then set state to "generated"
    if (props.toolCall.function.arguments.length === 0) {
      return;
    }

    const [done, _] = incrementalParseJson(props.toolCall.function.arguments);
    if (done) {
      dispatch(setGeneratedOutput(props.toolCall));
    }
  }, [props.toolCall.function.arguments]);

  function getIcon(state: ToolState) {
    switch (state) {
      case "generating":
        return <Spinner />;
      case "done":
        return <CheckIcon className="text-green-500" color={lightGray} />;
      case "calling":
        return <Spinner />;
      case "canceled":
        return <XMarkIcon className="text-red-500" />;
      case "generated":
        return <PlayIcon color={lightGray} />;
    }
  }

  return (
    <ThreadDiv icon={getIcon(toolCallState.currentToolCallState)}>
      <FunctionSpecificToolCallDiv
        toolCall={props.toolCall}
        state={toolCallState.currentToolCallState}
      />
    </ThreadDiv>
  );
}
