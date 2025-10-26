import { useAppSelector } from "../../../redux/hooks";
import {
  selectPendingToolCalls,
  selectToolCallsByStatus,
} from "../../../redux/selectors/selectToolCalls";
import { LumpToolbar } from "./LumpToolbar/LumpToolbar";

/**
 * Simplified toolbar component that only shows when there's active content
 */
export function Lump() {
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const isInEdit = useAppSelector((state) => state.session.isInEdit);
  const ttsActive = useAppSelector((state) => state.ui.ttsActive);
  const pendingToolCalls = useAppSelector(selectPendingToolCalls);
  const callingToolCalls = useAppSelector((state) =>
    selectToolCallsByStatus(state, "calling"),
  );
  const applyStates = useAppSelector(
    (state) => state.session.codeBlockApplyStates.states,
  );
  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );
  const isApplying = applyStates.some((state) => state.status === "streaming");

  // Only show Lump when there's active content
  const hasActiveContent =
    isStreaming ||
    isInEdit ||
    ttsActive ||
    isApplying ||
    pendingToolCalls.length > 0 ||
    callingToolCalls.length > 0 ||
    pendingApplyStates.length > 0;

  if (!hasActiveContent) {
    return null;
  }

  return (
    <div className="bg-input rounded-t-default border-command-border mx-1.5 border-l border-r border-t">
      <div className="xs:px-2 px-1 py-0.5">
        <LumpToolbar />
      </div>
    </div>
  );
}
