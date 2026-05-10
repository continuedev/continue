import {
  ChevronUpIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";
import { isRecommendedAgentModel } from "core/llm/toolSupport";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      setIsOpen(false);
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
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cycleMode, isOpen]);

  // Auto-switch from background mode when local agent is selected
  useEffect(() => {
    if (mode === "background" && isLocalAgent) {
      dispatch(setMode("agent"));
    }
  }, [mode, isLocalAgent, dispatch]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

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
    <div
      ref={containerRef}
      className="relative"
      data-testid="mode-select-button"
    >
      <ToolTip
        style={{ zIndex: 200001 }}
        content={`${metaKeyLabel} . to cycle modes`}
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={`Mode: ${activeOption.label}. Click to change.`}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-lg border border-solid border-transparent px-2 text-xs transition-colors",
            "hover:bg-vsc-input-background/70 hover:text-vsc-foreground text-description",
            isOpen && "bg-vsc-input-background/70 text-vsc-foreground",
          )}
        >
          <ModeIcon mode={mode} />
          <span className="hidden sm:inline">{activeOption.label}</span>
          {activeOption.warning && (
            <ExclamationTriangleIcon className="text-warning h-3 w-3" />
          )}
          <ChevronUpIcon
            className={cn(
              "h-3 w-3 transition-transform duration-150",
              isOpen ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
      </ToolTip>

      {isOpen && (
        <div
          role="menu"
          className="border-command-border bg-vsc-editor-background absolute bottom-full left-0 z-[200002] mb-1 min-w-[10rem] overflow-hidden rounded-xl border border-solid shadow-lg"
        >
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              disabled={option.disabled}
              onClick={() => selectMode(option.value)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors",
                mode === option.value
                  ? "bg-vsc-input-background/80 text-vsc-foreground font-medium"
                  : "text-description hover:bg-vsc-input-background/60 hover:text-vsc-foreground",
                option.disabled &&
                  "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-inherit",
              )}
              aria-current={mode === option.value ? "true" : undefined}
            >
              <ModeIcon mode={option.value} />
              <span className="flex-1">{option.label}</span>
              {(option.warning || option.disabled) && (
                <ExclamationTriangleIcon className="text-warning h-3 w-3 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
