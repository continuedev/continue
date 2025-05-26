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
import { EditOutcomeToolbar } from "./EditOutcomeToolbar";
import { EditToolbar } from "./EditToolbar";
import { IsApplyingToolbar } from "./IsApplyingToolbar";
import { PendingApplyStatesToolbar } from "./PendingApplyStatesToolbar";
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
  const editApplyState = useAppSelector(
    (state) => state.editModeState.applyState,
  );
  const applyStates = useAppSelector(
    (state) => state.session.codeBlockApplyStates.states,
  );

  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );

  const isApplying = applyStates.some((state) => state.status === "streaming");

  useEffect(() => {
    if (toolCallState?.status !== "generated") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
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
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toolCallState]);

  if (isApplying) {
    return <IsApplyingToolbar />;
  }

  if (isInEdit) {
    if (editApplyState.status === "done") {
      return <EditOutcomeToolbar />;
    }

    return <EditToolbar />;
  }

  if (ttsActive) {
    return <TtsActiveToolbar />;
  }

  if (isStreaming) {
    return <StreamingToolbar />;
  }

  if (toolCallState?.status === "generated") {
    return <PendingToolCallToolbar />;
  }

  if (pendingApplyStates.length > 0) {
    return (
      <PendingApplyStatesToolbar pendingApplyStates={pendingApplyStates} />
    );
  }

  return <BlockSettingsTopToolbar />;
}
