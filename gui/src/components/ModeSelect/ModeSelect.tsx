import {
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { isRecommendedAgentModel } from "core/llm/toolSupport";
import { formatLoopStatus } from "core/util/loopMode";
import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  ModeEntry,
  selectModeEntry,
} from "../../redux/selectors/selectModeEntry";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { chooseLoopMode, leaveLoopMode } from "../../redux/thunks/loop";
import { getFontSize, getMetaKeyLabel } from "../../util";
import {
  getModeModelTitle,
  getModeReasoningEffort,
} from "../../util/modeModels";
import { ToolTip } from "../gui/Tooltip";
import { useMainEditor } from "../mainInput/TipTapEditor";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";
import { ModeIcon } from "./ModeIcon";
import { ModeSwitchCacheNotice } from "./ModeSwitchCacheNotice";

/** Shows which model (and reasoning effort) a mode uses, when configured. */
function ModeModelHint({ mode }: { mode: "chat" | "agent" | "plan" }) {
  const config = useAppSelector((state) => state.config.config);
  const overrides = useAppSelector((state) => state.ui.modeModelOverrides);
  const title = getModeModelTitle(config, mode, overrides);
  if (!title) return null;
  const effort = getModeReasoningEffort(config, mode);
  const label = effort && effort !== "off" ? `${title} · ${effort}` : title;
  return (
    <span
      className="max-w-24 truncate text-xs text-description-muted"
      title={`Model for ${mode} mode: ${label}`}
      data-testid={`mode-model-${mode}`}
    >
      {label}
    </span>
  );
}

const ENTRY_LABELS: Record<ModeEntry, string> = {
  chat: "Chat",
  plan: "Plan",
  agent: "Agent",
  background: "Background",
  loop: "Loop",
};

/** Mod+. goes to the next entry: Chat, Plan, Agent, Loop. */
const NEXT_ENTRY: Record<ModeEntry, ModeEntry> = {
  chat: "plan",
  plan: "agent",
  agent: "loop",
  loop: "chat",
  background: "chat",
};

export function ModeSelect() {
  const dispatch = useAppDispatch();
  // Loop is an entry, not a mode: underneath, the turns are Plan and Agent
  const mode = useAppSelector(selectModeEntry);
  const loop = useAppSelector((store) => store.session.loop);
  const loopStatus = loop ? formatLoopStatus(loop) : undefined;
  const selectedModel = useAppSelector(selectSelectedChatModel);

  const isGoodAtAgentMode = useMemo(() => {
    if (!selectedModel) {
      return undefined;
    }
    return isRecommendedAgentModel(selectedModel.model);
  }, [selectedModel]);

  const { mainEditor } = useMainEditor();
  const metaKeyLabel = useMemo(() => {
    return getMetaKeyLabel();
  }, []);

  /**
   * Loop sets Plan mode and the session's loopRequested; leaving it while a
   * loop runs stops the loop after the running item, then switches.
   */
  const pick = useCallback(
    (entry: ModeEntry) => {
      if (entry === "loop") {
        void dispatch(chooseLoopMode());
      } else {
        void dispatch(leaveLoopMode(entry));
      }
    },
    [dispatch],
  );

  const cycleMode = useCallback(() => {
    pick(NEXT_ENTRY[mode]);
    // Only focus main editor if another one doesn't already have focus
    if (!document.activeElement?.classList?.contains("ProseMirror")) {
      mainEditor?.commands.focus();
    }
  }, [mode, mainEditor, pick]);

  const selectMode = useCallback(
    (newMode: ModeEntry) => {
      if (newMode === mode) {
        return;
      }

      pick(newMode);

      mainEditor?.commands.focus();
    },
    [mode, mainEditor, pick],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "." && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void cycleMode();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cycleMode]);

  const notGreatAtAgent = (mode: string) => (
    <>
      <ToolTip
        style={{
          zIndex: 200001, // in front of listbox
        }}
        className="flex items-center gap-1"
        content={`${mode} might not work well with this model.`}
      >
        <ExclamationTriangleIcon className="h-2.5 w-2.5 text-warning" />
      </ToolTip>
    </>
  );

  return (
    <Listbox value={mode} onChange={selectMode}>
      <div
        className="relative"
        title={mode === "loop" ? loopStatus : undefined}
        data-testid="mode-select"
      >
        <ListboxButton
          data-testid="mode-select-button"
          className="gap-1 rounded-full border-none bg-lightgray/20 px-1.5 py-0.5 text-description transition-colors duration-200 hover:brightness-110 xs:px-2"
        >
          <ModeIcon mode={mode} />
          <span className="hidden sm:block">{ENTRY_LABELS[mode]}</span>
          <ChevronDownIcon className="h-2 w-2 shrink-0" aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions className="max-w-48 min-w-32">
          <ListboxOption value="chat" data-testid="mode-option-chat">
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="chat" />
              <span className="">Chat</span>
              <ModeModelHint mode="chat" />
              <ToolTip
                style={{
                  zIndex: 200001,
                }}
                content="All tools disabled"
              >
                <InformationCircleIcon
                  data-tooltip-id="chat-tip"
                  className="h-2.5 w-2.5 shrink-0"
                />
              </ToolTip>
              <span
                className={`text-description-muted text-[${getFontSize() - 3}px] mr-auto`}
              >
                {getMetaKeyLabel()}L
              </span>
            </div>
            {mode === "chat" && <CheckIcon className="ml-auto h-3 w-3" />}
          </ListboxOption>
          <ListboxOption
            value="plan"
            className={"gap-1"}
            data-testid="mode-option-plan"
          >
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="plan" />
              <span className="">Plan</span>
              <ModeModelHint mode="plan" />
              <ToolTip
                style={{
                  zIndex: 200001,
                }}
                content="Read-only/MCP tools available"
              >
                <InformationCircleIcon className="h-2.5 w-2.5 shrink-0" />
              </ToolTip>
            </div>
            {!isGoodAtAgentMode && notGreatAtAgent("Plan")}
            <CheckIcon
              className={`ml-auto h-3 w-3 ${mode === "plan" ? "" : "opacity-0"}`}
            />
          </ListboxOption>

          <ListboxOption
            value="agent"
            className={"gap-1"}
            data-testid="mode-option-agent"
          >
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="agent" />
              <span className="">Agent</span>
              <ModeModelHint mode="agent" />
              <ToolTip
                style={{
                  zIndex: 200001,
                }}
                content="All tools available"
              >
                <InformationCircleIcon className="h-2.5 w-2.5 shrink-0" />
              </ToolTip>
            </div>
            {!isGoodAtAgentMode && notGreatAtAgent("Agent")}
            <CheckIcon
              className={`ml-auto h-3 w-3 ${mode === "agent" ? "" : "opacity-0"}`}
            />
          </ListboxOption>

          <ListboxOption
            value="loop"
            className={"gap-1"}
            data-testid="mode-option-loop"
          >
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-row items-center gap-1.5">
                <ModeIcon mode="loop" />
                <span className="">Loop</span>
                <ToolTip
                  style={{
                    zIndex: 200001,
                  }}
                  content="Plans first, then builds the plan's to-dos one at a time"
                >
                  <InformationCircleIcon className="h-2.5 w-2.5 shrink-0" />
                </ToolTip>
              </div>
              {mode === "loop" && loopStatus && (
                <span
                  className="truncate text-xs text-description-muted"
                  data-testid="mode-loop-status"
                >
                  {loopStatus}
                </span>
              )}
            </div>
            <CheckIcon
              className={`ml-auto h-3 w-3 shrink-0 ${mode === "loop" ? "" : "opacity-0"}`}
            />
          </ListboxOption>

          <div className="px-2 py-1 text-description-muted">
            {`${metaKeyLabel} . for next mode`}
          </div>
          <ModeSwitchCacheNotice />
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
