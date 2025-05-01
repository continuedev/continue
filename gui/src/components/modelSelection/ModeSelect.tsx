// A dropdown menu for selecting between Chat, Edit, and Agent modes with keyboard shortcuts
import {
  ChatBubbleLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { useCallback, useEffect, useMemo } from "react";
import styled from "styled-components";
import { lightGray } from "..";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setMode } from "../../redux/slices/sessionSlice";
import { enterEditMode, exitEditMode } from "../../redux/thunks/editMode";
import { getFontSize, getMetaKeyLabel, isJetBrains } from "../../util";
import { useMainEditor } from "../mainInput/TipTapEditor";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../ui/Listbox";

const ShortcutText = styled.span`
  color: ${lightGray};
  font-size: ${getFontSize() - 3}px;
  margin-right: auto;
`;

function ModeSelect() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((store) => store.session.mode);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const agentModeSupported = useMemo(() => {
    return selectedModel && modelSupportsTools(selectedModel);
  }, [selectedModel]);
  const { mainEditor } = useMainEditor();
  const jetbrains = useMemo(() => {
    return isJetBrains();
  }, []);
  const metaKeyLabel = useMemo(() => {
    return getMetaKeyLabel();
  }, []);

  const getModeIcon = (mode: MessageModes) => {
    switch (mode) {
      case "agent":
        return <SparklesIcon className="xs:h-3 xs:w-3 h-3 w-3" />;
      case "chat":
        return <ChatBubbleLeftIcon className="xs:h-3 xs:w-3 h-3 w-3" />;
      case "edit":
        return <PencilIcon className="xs:h-3 xs:w-3 h-3 w-3" />;
    }
  };

  // Switch to chat mode if agent mode is selected but not supported
  useEffect(() => {
    if (!selectedModel) {
      return;
    }
    if (mode === "agent" && !agentModeSupported) {
      dispatch(setMode("chat"));
    }
  }, [mode, agentModeSupported, dispatch, selectedModel]);

  const cycleMode = useCallback(async () => {
    const modes: MessageModes[] = jetbrains
      ? ["chat", "agent"]
      : ["chat", "agent", "edit"];
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];

    if (mode === "edit") {
      await dispatch(
        exitEditMode({
          goToMode: nextMode,
        }),
      );
    } else {
      if (nextMode === "edit") {
        await dispatch(
          enterEditMode({
            returnToMode: mode,
          }),
        );
      } else {
        dispatch(setMode(nextMode));
      }
    }
    mainEditor?.commands.focus();
  }, [jetbrains, mode, mainEditor]);

  const selectMode = useCallback(
    async (newMode: MessageModes) => {
      if (newMode === mode) {
        return;
      }
      if (newMode === "edit") {
        await dispatch(
          enterEditMode({
            returnToMode: mode,
          }),
        );
      } else {
        if (mode === "edit") {
          await dispatch(
            exitEditMode({
              goToMode: newMode,
            }),
          );
        } else {
          dispatch(setMode(newMode));
        }
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

  return (
    <Listbox value={mode} onChange={selectMode}>
      <div className="relative">
        <ListboxButton
          data-testid="mode-select-button"
          className="xs:px-2 gap-1 border-none px-1.5 py-0.5 text-gray-400 transition-colors duration-200"
          style={{
            backgroundColor: `${lightGray}33`,
            borderRadius: "9999px",
          }}
        >
          {getModeIcon(mode)}
          <span className="hidden sm:block">
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </span>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-32 max-w-48">
          {!jetbrains && (
            <ListboxOption value="edit">
              <div className="flex flex-row items-center gap-1.5">
                <PencilIcon className="h-3 w-3" />
                <span className="">Edit</span>
                <ShortcutText>{getMetaKeyLabel()}I</ShortcutText>
              </div>
              {mode === "edit" && <CheckIcon className="ml-auto h-3 w-3" />}
            </ListboxOption>
          )}
          <ListboxOption value="chat">
            <div className="flex flex-row items-center gap-1.5">
              <ChatBubbleLeftIcon className="h-3 w-3" />
              <span className="">Chat</span>
              <ShortcutText>{getMetaKeyLabel()}L</ShortcutText>
            </div>
            {mode === "chat" && <CheckIcon className="ml-auto h-3 w-3" />}
          </ListboxOption>

          <ListboxOption value="agent" disabled={!agentModeSupported}>
            <div className="flex flex-row items-center gap-1.5">
              <SparklesIcon className="h-3 w-3" />
              <span className="">Agent</span>
            </div>
            {mode === "agent" && <CheckIcon className="ml-auto h-3 w-3" />}
            {!agentModeSupported && <span> (Not supported)</span>}
          </ListboxOption>

          <div className="text-lightgray px-2 py-1">
            {metaKeyLabel}. for next mode
          </div>
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

export default ModeSelect;
