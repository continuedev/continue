import {
  ChevronDownIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { ComponentType, SVGProps, useContext, useMemo } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { updateConfig } from "../../redux/slices/configSlice";
import { setMode } from "../../redux/slices/sessionSlice";
import {
  QuickPermissionMode,
  setQuickPermissionMode,
} from "../../redux/slices/uiSlice";
import { cn } from "../../util/cn";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";

type PermissionPreset = "default" | "bypass" | "restrict" | "autopilot";

interface PermissionPresetOption {
  id: PermissionPreset;
  label: string;
  description: string;
  quickPermissionMode: QuickPermissionMode;
  codebaseToolCallingOnly?: boolean;
  forceAgentMode?: boolean;
  dotClassName: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const PERMISSION_PRESET_OPTIONS: PermissionPresetOption[] = [
  {
    id: "default",
    label: "Default Approvals",
    description: "Use your configured tool approval settings.",
    quickPermissionMode: "default",
    dotClassName: "bg-description-muted",
    icon: ShieldCheckIcon,
  },
  {
    id: "bypass",
    label: "Bypass Approvals",
    description: "Auto-approve eligible tool calls without prompts.",
    quickPermissionMode: "bypass",
    dotClassName: "bg-warning",
    icon: ExclamationTriangleIcon,
  },
  {
    id: "restrict",
    label: "Restricted",
    description: "Readonly-first permissions plus codebase tool calling.",
    quickPermissionMode: "restrict",
    codebaseToolCallingOnly: true,
    dotClassName: "bg-error",
    icon: LockClosedIcon,
  },
  {
    id: "autopilot",
    label: "Autopilot",
    description: "Agent mode with bypass approvals and codebase wiring.",
    quickPermissionMode: "bypass",
    codebaseToolCallingOnly: true,
    forceAgentMode: true,
    dotClassName: "bg-yellow-400",
    icon: SparklesIcon,
  },
];

export function PermissionModeSelect() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const mode = useAppSelector((state) => state.session.mode);
  const quickPermissionMode = useAppSelector(
    (state) => state.ui.quickPermissionMode,
  );

  const codebaseToolCallingOnly =
    config.experimental?.codebaseToolCallingOnly ?? false;

  const activePresetId: PermissionPreset = useMemo(() => {
    if (quickPermissionMode === "restrict") {
      return "restrict";
    }

    if (
      quickPermissionMode === "bypass" &&
      mode === "agent" &&
      codebaseToolCallingOnly
    ) {
      return "autopilot";
    }

    if (quickPermissionMode === "bypass") {
      return "bypass";
    }

    return "default";
  }, [quickPermissionMode, mode, codebaseToolCallingOnly]);

  const activePreset =
    PERMISSION_PRESET_OPTIONS.find((option) => option.id === activePresetId) ??
    PERMISSION_PRESET_OPTIONS[0];

  const applySharedConfig = (sharedConfig: SharedConfigSchema) => {
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  };

  const handlePresetChange = (presetId: PermissionPreset) => {
    const selectedOption = PERMISSION_PRESET_OPTIONS.find(
      (option) => option.id === presetId,
    );

    if (!selectedOption) {
      return;
    }

    dispatch(setQuickPermissionMode(selectedOption.quickPermissionMode));

    if (selectedOption.forceAgentMode && mode !== "agent") {
      dispatch(setMode("agent"));
    }

    if (
      selectedOption.codebaseToolCallingOnly !== undefined &&
      selectedOption.codebaseToolCallingOnly !== codebaseToolCallingOnly
    ) {
      applySharedConfig({
        codebaseToolCallingOnly: selectedOption.codebaseToolCallingOnly,
      });
    }
  };

  const ActiveIcon = activePreset.icon;

  return (
    <Listbox value={activePresetId} onChange={handlePresetChange}>
      <div className="relative">
        <ListboxButton
          data-testid="permission-mode-pill"
          aria-label="Select permission mode"
          className="text-description hover:bg-vsc-input-background h-7 gap-1 rounded-xl border-transparent px-2 text-[11px] font-medium transition-colors hover:brightness-150"
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              activePreset.dotClassName,
            )}
          />
          <ActiveIcon className="text-description-muted h-3 w-3" />
          <span className="text-[12px] font-medium">{activePreset.label}</span>
          <ChevronDownIcon className="text-description-muted h-3 w-3" />
        </ListboxButton>

        <ListboxOptions className="min-w-[260px] p-1">
          {PERMISSION_PRESET_OPTIONS.map((option) => {
            const isSelected = option.id === activePresetId;
            const OptionIcon = option.icon;

            return (
              <ListboxOption
                key={option.id}
                value={option.id}
                data-testid={`permission-mode-option-${option.id}`}
                className={cn(
                  "rounded-lg",
                  isSelected
                    ? "bg-list-active text-list-active-foreground"
                    : "",
                )}
              >
                <div className="flex w-full items-start gap-3 py-0.5">
                  <span
                    className={cn(
                      "mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full",
                      option.dotClassName,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <OptionIcon className="h-3.5 w-3.5" />
                      <span
                        className={cn(
                          "text-[12px]",
                          isSelected && "font-semibold",
                        )}
                      >
                        {option.label}
                      </span>
                    </div>
                    <div className="text-description-muted text-xs">
                      {option.description}
                    </div>
                  </div>
                </div>
              </ListboxOption>
            );
          })}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
