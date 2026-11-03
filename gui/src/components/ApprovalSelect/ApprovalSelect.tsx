import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectAutoApproval } from "../../redux/selectors/selectAutoApproval";
import { setApprovalMode } from "../../redux/slices/uiSlice";

/**
 * Manual / Auto switch for tool approval. Shown only while the experimental
 * "Auto approval" setting is on. Auto cannot be picked until a reviewer model
 * is chosen. Manual is the default and keeps today's behaviour.
 */
export function ApprovalSelect() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((state) => state.ui.approvalMode);
  const status = useAppSelector(selectAutoApproval);

  if (!status.offered) return null;

  const auto = status.active;
  const title = auto
    ? "Auto: a reviewer model approves or refuses tool calls your rules leave open. Click to go back to Manual."
    : status.available
      ? "Manual: you approve each tool call. Click to let the reviewer model decide (experimental)."
      : `Auto is not available. ${status.unavailableReason ?? ""}`;

  return (
    <button
      type="button"
      data-testid="approval-select"
      aria-pressed={auto}
      disabled={!status.available && mode !== "auto"}
      title={title}
      onClick={() => dispatch(setApprovalMode(auto ? "manual" : "auto"))}
      className="cursor-pointer rounded border-none bg-transparent px-1 text-xs text-description hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Approval: {auto ? "Auto" : "Manual"}
    </button>
  );
}
