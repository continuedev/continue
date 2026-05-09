import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";
import { isRecommendedAgentModel } from "core/llm/toolSupport";
import { useCallback, useEffect, useMemo } from "react";
import { useAuth } from "../../context/Auth";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setMode } from "../../redux/slices/sessionSlice";
import { getMetaKeyLabel } from "../../util";
import { cn } from "../../util/cn";
import { ToolTip } from "../gui/Tooltip";
import { useMainEditor } from "../mainInput/TipTapEditor";
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
      // Skip background mode if local agent is selected
      dispatch(setMode(isLocalAgent ? "chat" : "background"));
    } else {
      dispatch(setMode("chat"));
    }
    // Only focus main editor if another one doesn't already have focus
    if (!document.activeElement?.classList?.contains("ProseMirror")) {
      mainEditor?.commands.focus();
    }
  }, [mode, mainEditor, isLocalAgent]);

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

  return (
    <div
      data-testid="mode-select-button"
      className="bg-vsc-input-background flex items-center rounded-xl border border-solid border-transparent p-0.5"
    >
      {modeOptions.map((option) => {
        const button = (
          <button
            key={option.value}
            type="button"
            onClick={() => selectMode(option.value)}
            disabled={option.disabled}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-lg border-none px-2 text-xs transition-colors",
              mode === option.value
                ? "bg-vsc-editor-background text-vsc-foreground shadow-sm"
                : "text-description hover:bg-vsc-input-background/70 hover:text-vsc-foreground bg-transparent",
              option.disabled &&
                "hover:text-description cursor-not-allowed opacity-50 hover:bg-transparent",
            )}
            aria-pressed={mode === option.value}
            aria-label={`Switch to ${option.label} mode`}
          >
            <ModeIcon mode={option.value} />
            <span className="hidden sm:inline">{option.label}</span>
            {option.warning && (
              <ExclamationTriangleIcon className="text-warning h-3 w-3" />
            )}
            {option.disabled && (
              <ExclamationTriangleIcon className="text-warning h-3 w-3" />
            )}
          </button>
        );

        return (
          <ToolTip
            key={option.value}
            style={{
              zIndex: 200001,
            }}
            content={option.warning ?? option.description}
          >
            <div className="flex items-center">{button}</div>
          </ToolTip>
        );
      })}

      <ToolTip
        style={{
          zIndex: 200001,
        }}
        content={`${metaKeyLabel} . for next mode`}
      >
        <div className="text-description-muted hidden items-center gap-1 px-1.5 lg:flex">
          <InformationCircleIcon className="h-3 w-3" />
          <span className="text-[10px] font-medium">{metaKeyLabel} .</span>
        </div>
      </ToolTip>
    </div>
  );
}
