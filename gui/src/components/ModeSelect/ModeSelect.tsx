import {
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";
import {
  isRecommendedAgentModel,
  modelSupportsNativeTools,
} from "core/llm/toolSupport";
import { capitalize } from "lodash";
import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectUseSystemMessageTools } from "../../redux/selectors/selectUseSystemMessageTools";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setMode } from "../../redux/slices/sessionSlice";
import { getFontSize, getMetaKeyLabel } from "../../util";
import { ToolTip } from "../gui/Tooltip";
import { useMainEditor } from "../mainInput/TipTapEditor";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";
import { ModeIcon } from "./ModeIcon";

export function ModeSelect() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((store) => store.session.mode);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const useSystemTools = useAppSelector(selectUseSystemMessageTools);

  const isAgentSupported = useMemo(() => {
    if (!selectedModel) {
      return undefined;
    }
    return !!useSystemTools || modelSupportsNativeTools(selectedModel);
  }, [selectedModel, useSystemTools]);

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

  // Switch to chat mode if agent mode is selected but not supported
  useEffect(() => {
    if (!selectedModel) {
      return;
    }
    if (mode !== "chat" && !isAgentSupported) {
      dispatch(setMode("chat"));
    }
  }, [mode, isAgentSupported, selectedModel]);

  const cycleMode = useCallback(() => {
    if (mode === "chat") {
      dispatch(setMode("plan"));
    } else if (mode === "plan") {
      dispatch(setMode("agent"));
    } else {
      dispatch(setMode("chat"));
    }
    // Only focus main editor if another one doesn't already have focus
    if (!document.activeElement?.classList?.contains("ProseMirror")) {
      mainEditor?.commands.focus();
    }
  }, [mode, mainEditor]);

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

  const notSupported = <span>(Not supported)</span>;
  const notGreatAtAgent = (
    <>
      <ExclamationTriangleIcon
        data-tooltip-id="bad-at-agent-mode-tooltip"
        className="text-warning h-2.5 w-2.5"
      />
      <ToolTip
        id="bad-at-agent-mode-tooltip"
        style={{
          zIndex: 200001, // in front of listbox
        }}
        className="flex items-center gap-1"
      >
        {`${capitalize(mode)} might not work well with this model.`}
      </ToolTip>
    </>
  );

  return (
    <Listbox value={mode} onChange={selectMode}>
      <div className="relative">
        <ListboxButton
          data-testid="mode-select-button"
          className="xs:px-2 text-description bg-lightgray/20 gap-1 rounded-full border-none px-1.5 py-0.5 transition-colors duration-200 hover:brightness-110"
        >
          <ModeIcon mode={mode} />
          <span className="hidden sm:block">
            {mode === "chat" ? "Chat" : mode === "agent" ? "Agent" : "Plan"}
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
              <InformationCircleIcon
                data-tooltip-id="chat-tip"
                className="h-2.5 w-2.5 flex-shrink-0"
              />
              <ToolTip
                id="chat-tip"
                style={{
                  zIndex: 200001,
                }}
              >
                All tools disabled
              </ToolTip>
              <span
                className={`text-description-muted text-[${getFontSize() - 3}px] mr-auto`}
              >
                {getMetaKeyLabel()}L
              </span>
            </div>
            {mode === "chat" && <CheckIcon className="ml-auto h-3 w-3" />}
          </ListboxOption>
          <ListboxOption value="plan" className={"gap-1"}>
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="plan" />
              <span className="">Plan</span>
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
                Read-only/MCP tools available
              </ToolTip>
            </div>
            {isAgentSupported ? (
              <>
                {!isGoodAtAgentMode && notGreatAtAgent}
                <CheckIcon
                  className={`ml-auto h-3 w-3 ${mode === "plan" ? "" : "opacity-0"}`}
                />
              </>
            ) : (
              notSupported
            )}
          </ListboxOption>

          <ListboxOption value="agent" className={"gap-1"}>
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="agent" />
              <span className="">Agent</span>
              <InformationCircleIcon
                data-tooltip-id="agent-tip"
                className="h-2.5 w-2.5 flex-shrink-0"
              />
              <ToolTip
                id="agent-tip"
                style={{
                  zIndex: 200001,
                }}
              >
                All tools available
              </ToolTip>
            </div>
            {isAgentSupported ? (
              <>
                {!isGoodAtAgentMode && notGreatAtAgent}
                <CheckIcon
                  className={`ml-auto h-3 w-3 ${mode === "agent" ? "" : "opacity-0"}`}
                />
              </>
            ) : (
              notSupported
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
