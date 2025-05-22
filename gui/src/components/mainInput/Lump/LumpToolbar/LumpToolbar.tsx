import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { selectCurrentToolCall } from "../../../../redux/selectors/selectCurrentToolCall";
import {
  callCurrentTool,
  cancelCurrentToolCall,
} from "../../../../redux/thunks";
import { isJetBrains } from "../../../../util";
import { BlockSettingsTopToolbar } from "./BlockSettingsTopToolbar";
import { EditToolbar } from "./EditToolbar";
import { PendingToolCallToolbar } from "./PendingToolCallToolbar";
import { StreamingToolbar } from "./StreamingToolbar";
import { TtsActiveToolbar } from "./TtsActiveToolbar";

export function LumpToolbar() {
  const dispatch = useAppDispatch();
  const ttsActive = useAppSelector((state) => state.ui.ttsActive);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const isInEdit = useAppSelector((state) => state.session.isInEdit);
  const jetbrains = isJetBrains();
  const toolCallState = useSelector(selectCurrentToolCall);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (toolCallState?.status === "generated") {
      const metaKey = event.metaKey || event.ctrlKey;
      const altKey = event.altKey;

      if (metaKey && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        void dispatch(callCurrentTool());
      } else if ((jetbrains ? altKey : metaKey) && event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        void dispatch(cancelCurrentToolCall());
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toolCallState]);

  if (ttsActive) {
    return <TtsActiveToolbar />;
  }
  if (isStreaming) {
    return <StreamingToolbar />;
  }
  if (toolCallState?.status === "generated") {
    return <PendingToolCallToolbar />;
  }
  if (isInEdit) {
    return <EditToolbar />;
  }

  return <BlockSettingsTopToolbar />;
}
