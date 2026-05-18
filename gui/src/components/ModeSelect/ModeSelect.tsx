import {
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";
import { isRecommendedAgentModel } from "core/llm/toolSupport";
import { useCallback, useEffect, useMemo } from "react";
import { ToolTip } from "../../components/gui/Tooltip";
import { useAuth } from "../../context/Auth";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setMode } from "../../redux/slices/sessionSlice";
import { getMetaKeyLabel } from "../../util";
import { cn } from "../../util/cn";
import { useMainEditor } from "../mainInput/TipTapEditor";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
  useFontSize,
} from "../ui";
import { Divider } from "../ui/Divider";
import { ModeIcon } from "./ModeIcon";

interface ModeOption {
  value: MessageModes;
  label: string;
  description: string;
  disabled?: boolean;
  warning?: string;
}

export function ModeSelect() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((store) => store.session.mode);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const { selectedProfile } = useAuth();
  const tinyFont = useFontSize(-4);

  const isGoodAtAgentMode = useMemo(() => {
    if (!selectedModel) {
      return undefined;
    }
    return isRecommendedAgentModel(selectedModel.model);
  }, [selectedModel]);

  const isLocalAgent = useMemo(() => {
    return selectedProfile?.profileType === "local";
  }, [selectedProfile]);

  const { mainEditor } = useMainEditor();
  const metaKeyLabel = useMemo(() => {
    return getMetaKeyLabel();
  }, []);

  const cycleMode = useCallback(() => {
    if (mode === "chat") {
      dispatch(setMode("plan"));
    } else if (mode === "plan") {
      dispatch(setMode("agent"));
    } else if (mode === "agent") {
      dispatch(setMode(isLocalAgent ? "chat" : "background"));
    } else {
      dispatch(setMode("chat"));
    }
    if (!document.activeElement?.classList?.contains("ProseMirror")) {
      mainEditor?.commands.focus();
    }
  }, [mode, mainEditor, isLocalAgent]);

  const selectMode = useCallback(
    (newMode: MessageModes) => {
      if (newMode !== mode) {
        dispatch(setMode(newMode));
      }
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

  // Auto-switch from background mode when local agent is selected
  useEffect(() => {
    if (mode === "background" && isLocalAgent) {
      dispatch(setMode("agent"));
    }
  }, [mode, isLocalAgent, dispatch]);

  const modeOptions: ModeOption[] = useMemo(() => {
    return [
      {
        value: "chat",
        label: "Chat",
        description: "All tools disabled",
      },
      {
        value: "plan",
        label: "Plan",
        description: "Read-only and MCP tools available",
        warning: !isGoodAtAgentMode
          ? "Plan might not work well with this model."
          : undefined,
      },
      {
        value: "agent",
        label: "Agent",
        description: "All tools available",
        warning: !isGoodAtAgentMode
          ? "Agent might not work well with this model."
          : undefined,
      },
      {
        value: "background",
        label: "Background",
        description: isLocalAgent
          ? "Background mode cannot be used with local agents."
          : "Run as a background agent task",
        disabled: isLocalAgent,
      },
    ];
  }, [isGoodAtAgentMode, isLocalAgent]);

  const activeOption =
    modeOptions.find((o) => o.value === mode) ?? modeOptions[0];

  return (
    <Listbox value={mode} onChange={selectMode}>
      <div className="relative flex" data-testid="mode-select-button">
        <ToolTip place="top" content="Select mode">
          <ListboxButton className="text-description h-[18px] gap-1 border-none p-3">
            <ModeIcon mode={mode} />
            <span className="line-clamp-1 hidden break-all text-[12px] hover:brightness-110 sm:inline">
              {activeOption.label}
            </span>
            {activeOption.warning && (
              <ExclamationTriangleIcon className="text-warning h-3 w-3 flex-shrink-0" />
            )}
            <ChevronDownIcon
              className="hidden h-2 w-2 flex-shrink-0 hover:brightness-110 min-[200px]:flex"
              aria-hidden="true"
            />
          </ListboxButton>
        </ToolTip>
        <Transition>
          <ListboxOptions className="min-w-[160px]">
            <div className="flex items-center justify-between px-1.5 py-1">
              <span className="text-description text-xs font-medium">Mode</span>
            </div>

            <div className="no-scrollbar overflow-y-auto">
              {modeOptions.map((option) => (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    mode === option.value
                      ? "bg-list-active text-list-active-foreground"
                      : "",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-5">
                    <div className="flex items-center gap-2 py-0.5">
                      <ModeIcon mode={option.value} />
                      <span className="line-clamp-1">{option.label}</span>
                    </div>
                    {(option.warning || option.disabled) && (
                      <ExclamationTriangleIcon className="text-warning h-3 w-3 flex-shrink-0" />
                    )}
                  </div>
                </ListboxOption>
              ))}
            </div>

            <Divider className="!my-0" />
            <div className="text-description flex items-center justify-start p-2">
              <span className="block" style={{ fontSize: tinyFont }}>
                <code>{metaKeyLabel} .</code> to cycle mode
              </span>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
