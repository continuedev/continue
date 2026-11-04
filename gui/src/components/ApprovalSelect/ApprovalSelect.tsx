import {
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectAutoApproval,
  selectEffectiveApprovalMode,
} from "../../redux/selectors/selectAutoApproval";
import { ApprovalMode, setApprovalMode } from "../../redux/slices/uiSlice";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";

export const APPROVAL_LABELS: Record<ApprovalMode, string> = {
  manual: "Manual",
  autoApprove: "Auto-approve",
  auto: "Auto",
  yolo: "YOLO",
};

export const APPROVAL_DESCRIPTIONS: Record<ApprovalMode, string> = {
  manual:
    "You approve each tool call. Your rules in config.yaml still apply. This is the default.",
  autoApprove:
    "Tool calls in the categories you switched on (Settings > Tools) run without asking. Rules and protected paths still apply.",
  auto: "Like Auto-approve, and a reviewer model decides what is left: it allows, asks you, or refuses. Experimental.",
  yolo: "Everything runs without asking, except what a deny rule, an ask rule, a protected path or the safety check stops. Dangerous.",
};

/**
 * The Approval picker: Manual, Auto-approve, Auto (experimental, needs a
 * reviewer model) and YOLO. Manual is the default.
 */
export function ApprovalSelect() {
  const dispatch = useAppDispatch();
  const saved = useAppSelector((state) => state.ui.approvalMode);
  const effective = useAppSelector(selectEffectiveApprovalMode);
  const status = useAppSelector(selectAutoApproval);

  const options: ApprovalMode[] = ["manual", "autoApprove"];
  if (status.offered) options.push("auto");
  options.push("yolo");

  const yolo = effective === "yolo";
  // A saved Auto that cannot run shows as Manual, which is what is in force.
  const shown = saved === "auto" && effective === "manual" ? "manual" : saved;

  return (
    <Listbox
      value={shown}
      onChange={(mode: ApprovalMode) => dispatch(setApprovalMode(mode))}
    >
      <div className="relative" title={APPROVAL_DESCRIPTIONS[shown]}>
        <ListboxButton
          data-testid="approval-select"
          className={`flex-none gap-1 rounded-full border-none px-1.5 py-0.5 transition-colors duration-200 hover:brightness-110 ${
            yolo ? "bg-error/20 text-error" : "bg-lightgray/20 text-description"
          }`}
        >
          {yolo && <ExclamationTriangleIcon className="h-2.5 w-2.5" />}
          <span>{APPROVAL_LABELS[shown]}</span>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-40 max-w-64">
          {options.map((mode) => {
            const unavailable = mode === "auto" && !status.available;
            return (
              <ListboxOption
                key={mode}
                value={mode}
                disabled={unavailable}
                data-testid={`approval-option-${mode}`}
                className="items-start gap-1"
              >
                <div className="flex flex-col">
                  <span className={mode === "yolo" ? "text-error" : ""}>
                    {APPROVAL_LABELS[mode]}
                  </span>
                  <span className="whitespace-normal text-2xs text-description-muted">
                    {unavailable
                      ? `Not available. ${status.unavailableReason ?? ""}`
                      : APPROVAL_DESCRIPTIONS[mode]}
                  </span>
                </div>
                <CheckIcon
                  className={`ml-auto h-3 w-3 flex-shrink-0 ${shown === mode ? "" : "opacity-0"}`}
                />
              </ListboxOption>
            );
          })}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

/**
 * Shown above the input for as long as YOLO is on. It has no close button on
 * purpose: the way to remove it is to leave YOLO.
 */
export function YoloBanner() {
  const dispatch = useAppDispatch();
  const yolo = useAppSelector(selectEffectiveApprovalMode) === "yolo";
  if (!yolo) return null;
  return (
    <div
      role="alert"
      data-testid="yolo-banner"
      className="bg-error/15 flex items-center gap-2 px-2 py-0.5 text-2xs text-error"
    >
      <ExclamationTriangleIcon className="h-3 w-3 flex-shrink-0" />
      <span className="flex-1">
        YOLO: tool calls run without asking. Deny rules, ask rules, protected
        paths and the safety check still apply.
      </span>
      <button
        type="button"
        className="cursor-pointer border-none bg-transparent text-2xs text-error underline"
        onClick={() => dispatch(setApprovalMode("manual"))}
      >
        Switch to Manual
      </button>
    </div>
  );
}
