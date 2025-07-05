import {
  CheckIcon,
  ChevronDownIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setMode, setReadOnly } from "../../redux/slices/sessionSlice";
import { getFontSize, getMetaKeyLabel } from "../../util";
import { ToolTip } from "../gui/Tooltip";
import { useMainEditor } from "../mainInput/TipTapEditor";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";
import { ModeIcon } from "./ModeIcon";

export function ModeSelect() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((store) => store.session.mode);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const agentModeSupported = useMemo(() => {
    return selectedModel && modelSupportsTools(selectedModel);
  }, [selectedModel]);
  const { mainEditor } = useMainEditor();
  const metaKeyLabel = useMemo(() => {
    return getMetaKeyLabel();
  }, []);

  // Switch to chat mode if agent mode is selected but not supported
  useEffect(() => {
    if (!selectedModel) {
      return;
    }
    if (mode === "agent" && !agentModeSupported) {
      dispatch(setMode("chat"));
    }
  }, [mode, agentModeSupported, dispatch, selectedModel]);

  const readOnlyMode = useAppSelector((store) => store.session.readOnlyMode);
  const pseudoMode = useMemo(() => {
    return mode === "chat" ? "chat" : readOnlyMode ? "plan" : "agent";
  }, [mode, readOnlyMode]);
  const cycleMode = useCallback(() => {
    if (pseudoMode === "chat") {
      dispatch(setMode("agent"));
      dispatch(setReadOnly(true));
    } else if (pseudoMode === "plan") {
      dispatch(setReadOnly(false));
    } else {
      dispatch(setReadOnly(true));
      dispatch(setMode("chat"));
    }
    // Only focus main editor if another one doesn't already have focus
    if (!document.activeElement?.classList?.contains("ProseMirror")) {
      mainEditor?.commands.focus();
    }
  }, [pseudoMode, mainEditor]);

  const selectMode = useCallback(
    (newMode: MessageModes) => {
      if (newMode === mode) {
        return;
      }

      dispatch(setMode(newMode));

      mainEditor?.commands.focus();
    },
    [mode, mainEditor],
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

  return (
    <Listbox value={mode} onChange={selectMode}>
      <div className="relative">
        <ListboxButton
          data-testid="mode-select-button"
          className="xs:px-2 text-description bg-lightgray/20 gap-1 rounded-full border-none px-1.5 py-0.5 transition-colors duration-200 hover:brightness-110"
        >
          <ModeIcon mode={pseudoMode} />
          <span className="hidden sm:block">
            {pseudoMode === "chat"
              ? "Chat"
              : pseudoMode === "agent"
                ? "Agent"
                : "Plan"}
          </span>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-32 max-w-48">
          <ListboxOption value="chat">
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="chat" />
              <span className="">Chat</span>
              <span
                className={`text-description-muted text-[${getFontSize() - 3}px] mr-auto`}
              >
                {getMetaKeyLabel()}L
              </span>
            </div>
            {pseudoMode === "chat" && <CheckIcon className="ml-auto h-3 w-3" />}
          </ListboxOption>
          <ListboxOption
            value="agent"
            disabled={!agentModeSupported}
            className={"gap-1"}
            onClick={() => {
              dispatch(setReadOnly(true));
            }}
          >
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="plan" />
              <span className="">Agent (Plan)</span>
              <InformationCircleIcon
                data-tooltip-id="plan-tip"
                className="h-2.5 w-2.5 flex-shrink-0"
              />
              <ToolTip
                id="plan-tip"
                style={{
                  zIndex: 200001,
                }}
              >
                In Plan mode, the Agent can only use read-only tools
              </ToolTip>
            </div>
            {agentModeSupported ? (
              <CheckIcon
                className={`ml-auto h-3 w-3 ${pseudoMode === "plan" ? "" : "opacity-0"}`}
              />
            ) : (
              <span>(Not supported)</span>
            )}
          </ListboxOption>
          <ListboxOption
            value="agent"
            disabled={!agentModeSupported}
            className={"gap-1"}
            onClick={() => {
              dispatch(setReadOnly(false));
            }}
          >
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="agent" />
              <span className="">Agent (Act)</span>
              <InformationCircleIcon
                data-tooltip-id="act-tip"
                className="h-2.5 w-2.5 flex-shrink-0"
              />
              <ToolTip
                id="act-tip"
                style={{
                  zIndex: 200001,
                }}
              >
                In Act mode, the Agent can use create/edit tools
              </ToolTip>
            </div>
            {agentModeSupported ? (
              <CheckIcon
                className={`ml-auto h-3 w-3 ${pseudoMode === "agent" ? "" : "opacity-0"}`}
              />
            ) : (
              <span>(Not supported)</span>
            )}
          </ListboxOption>

          <div className="text-description-muted px-2 py-1">
            {`${metaKeyLabel} . for next mode`}
          </div>
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
