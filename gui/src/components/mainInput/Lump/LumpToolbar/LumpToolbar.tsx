import { useContext, useEffect } from "react";
import { useSelector } from "react-redux";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import {
  selectFirstPendingToolCall,
  selectPendingToolCalls,
} from "../../../../redux/selectors/selectToolCalls";
import { cancelToolCall } from "../../../../redux/slices/sessionSlice";
import { callToolById } from "../../../../redux/thunks/callToolById";
import { logToolUsage } from "../../../../redux/util";
import { isJetBrains } from "../../../../util";
import { BlockSettingsTopToolbar } from "./BlockSettingsTopToolbar";
import { EditOutcomeToolbar } from "./EditOutcomeToolbar";
import { EditToolbar } from "./EditToolbar";
import { IsApplyingToolbar } from "./IsApplyingToolbar";
import { PendingApplyStatesToolbar } from "./PendingApplyStatesToolbar";
import { PendingToolCallToolbar } from "./PendingToolCallToolbar";
import { StreamingToolbar } from "./StreamingToolbar";
import { TtsActiveToolbar } from "./TtsActiveToolbar";

// Keyboard shortcut detection utilities
const isExecuteToolCallShortcut = (event: KeyboardEvent) => {
  const metaKey = event.metaKey || event.ctrlKey;
  return metaKey && event.key === "Enter";
};

const isCancelToolCallShortcut = (
  event: KeyboardEvent,
  isJetBrains: boolean,
) => {
  const metaKey = event.metaKey || event.ctrlKey;
  const altKey = event.altKey;
  const modifierKey = isJetBrains ? altKey : metaKey;
  return modifierKey && event.key === "Backspace";
};

export function LumpToolbar() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const ttsActive = useAppSelector((state) => state.ui.ttsActive);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const isInEdit = useAppSelector((state) => state.session.isInEdit);
  const jetbrains = isJetBrains();
  const pendingToolCalls = useAppSelector(selectPendingToolCalls);
  const firstPendingToolCall = useAppSelector(selectFirstPendingToolCall);
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
    if (!firstPendingToolCall) {
      return;
    }

    const handleToolCallKeyboardShortcuts = (event: KeyboardEvent) => {
      if (isExecuteToolCallShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();

        void dispatch(
          callToolById({ toolCallId: firstPendingToolCall.toolCallId }),
        );
      } else if (isCancelToolCallShortcut(event, jetbrains)) {
        event.preventDefault();
        event.stopPropagation();
        void dispatch(
          cancelToolCall({
            toolCallId: firstPendingToolCall.toolCallId,
          }),
        );

        logToolUsage(firstPendingToolCall, false, true, ideMessenger);
      }
    };

    document.addEventListener("keydown", handleToolCallKeyboardShortcuts);
    return () => {
      document.removeEventListener("keydown", handleToolCallKeyboardShortcuts);
    };
  }, [firstPendingToolCall]);

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

  if (pendingToolCalls.length > 0) {
    return <PendingToolCallToolbar />;
  }

  if (pendingApplyStates.length > 0) {
    return (
      <PendingApplyStatesToolbar pendingApplyStates={pendingApplyStates} />
    );
  }

  return <BlockSettingsTopToolbar />;
}
