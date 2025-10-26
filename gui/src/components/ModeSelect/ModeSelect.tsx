import {
  CheckIcon,
  ChevronDownIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";
import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setMode } from "../../redux/slices/sessionSlice";
import { getMetaKeyLabel } from "../../util";
import { ToolTip } from "../gui/Tooltip";
import { useMainEditor } from "../mainInput/TipTapEditor";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";
import { ModeIcon } from "./ModeIcon";

export function ModeSelect() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((store) => store.session.mode);

  const { mainEditor } = useMainEditor();
  const metaKeyLabel = useMemo(() => {
    return getMetaKeyLabel();
  }, []);

  const cycleMode = useCallback(() => {
    if (mode === "plan") {
      dispatch(setMode("agent"));
    } else {
      dispatch(setMode("plan"));
    }
    // Only focus main editor if another one doesn't already have focus
    if (!document.activeElement?.classList?.contains("ProseMirror")) {
      mainEditor?.commands.focus();
    }
  }, [mode, mainEditor, dispatch]);

  const selectMode = useCallback(
    (newMode: MessageModes) => {
      if (newMode === mode) {
        return;
      }

      dispatch(setMode(newMode));

      mainEditor?.commands.focus();
    },
    [mode, mainEditor, dispatch],
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
          <ModeIcon mode={mode} />
          <span className="hidden sm:block">
            {mode === "agent" ? "Agent" : "Plan"}
          </span>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-32 max-w-48">
          <ListboxOption value="plan" className={"gap-1"}>
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="plan" />
              <span className="">Plan</span>
              <ToolTip
                style={{
                  zIndex: 200001,
                }}
                content="Read-only tools for exploration (AWS SDK focused)"
              >
                <InformationCircleIcon className="h-2.5 w-2.5 flex-shrink-0" />
              </ToolTip>
            </div>
            <CheckIcon
              className={`ml-auto h-3 w-3 ${mode === "plan" ? "" : "opacity-0"}`}
            />
          </ListboxOption>

          <ListboxOption value="agent" className={"gap-1"}>
            <div className="flex flex-row items-center gap-1.5">
              <ModeIcon mode="agent" />
              <span className="">Agent</span>
              <ToolTip
                style={{
                  zIndex: 200001,
                }}
                content="All tools for implementation (AWS SDK focused)"
              >
                <InformationCircleIcon className="h-2.5 w-2.5 flex-shrink-0" />
              </ToolTip>
            </div>
            <CheckIcon
              className={`ml-auto h-3 w-3 ${mode === "agent" ? "" : "opacity-0"}`}
            />
          </ListboxOption>

          <div className="text-description-muted px-2 py-1">
            {`${metaKeyLabel} . to cycle modes`}
          </div>
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
