import type { ApprovalSettings } from "core/tools/permissions/approval";
import type { RootState } from "../store";

export const REVIEWER_NEEDED_MESSAGE =
  "Choose a reviewer model in Settings > Models";

export interface AutoApprovalStatus {
  /** The experimental setting is on, so the option is shown at all. */
  offered: boolean;
  /** Auto can be used: offered and a reviewer model is chosen. */
  available: boolean;
  /** The user picked Auto and it can be used. */
  active: boolean;
  /** Why it cannot be used, for the disabled option. */
  unavailableReason?: string;
}

/**
 * Auto is unavailable until a reviewer model is chosen. No chat model stands in
 * for it, because that would send the conversation to a provider the user did
 * not pick for this.
 */
export function selectAutoApproval(state: RootState): AutoApprovalStatus {
  const config = state.config.config;
  const offered = config.experimental?.enableAutoApproval === true;
  const hasReviewer = !!config.selectedModelByRole?.reviewer;
  const available = offered && hasReviewer;
  return {
    offered,
    available,
    active: available && state.ui.approvalMode === "auto",
    ...(offered && !hasReviewer
      ? { unavailableReason: REVIEWER_NEEDED_MESSAGE }
      : {}),
  };
}

/**
 * The mode that is really in force. A saved "auto" that cannot be used (no
 * reviewer, or the experiment turned off) falls back to Manual, not to the
 * switches, so a lost reviewer never makes the app more permissive.
 */
export function selectEffectiveApprovalMode(
  state: RootState,
): ApprovalSettings["mode"] {
  const mode = state.ui.approvalMode;
  if (mode === "auto") {
    return selectAutoApproval(state).active ? "auto" : "manual";
  }
  return mode;
}

/** What is sent to core with every policy check. Manual sends nothing. */
export function selectApprovalSettings(
  state: RootState,
): ApprovalSettings | undefined {
  const mode = selectEffectiveApprovalMode(state);
  if (mode === "manual") return undefined;
  return {
    mode,
    categories: state.ui.approvalCategories,
    mcpServers: state.ui.approvalMcpServers,
  };
}
