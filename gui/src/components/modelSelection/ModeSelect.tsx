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
import { useEffect, useMemo } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscInputBackground } from "..";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectDefaultModel } from "../../redux/slices/configSlice";
import {
  cycleMode,
  selectCurrentMode,
  setMode,
} from "../../redux/slices/sessionSlice";
import { getFontSize, getMetaKeyLabel, isJetBrains } from "../../util";
import Shortcut from "../gui/Shortcut";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../ui/Listbox";

const StyledListboxButton = styled(ListboxButton)`
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 2px;
  border: none;
  cursor: pointer;
  font-size: ${getFontSize() - 2}px;
  background: transparent;
  color: ${lightGray};
  &:focus {
    outline: none;
  }
`;

const StyledListboxOptions = styled(ListboxOptions)`
  margin-top: 4px;
  position: absolute;
  list-style: none;
  padding: 0px;
  min-width: 180px;
  cursor: default;
  display: flex;
  flex-direction: column;
  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${lightGray};
  background-color: ${vscInputBackground};
`;

const ShortcutText = styled.span`
  color: ${lightGray};
  font-size: ${getFontSize() - 3}px;
  margin-right: auto;
`;

function ModeSelect() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector(selectCurrentMode);
  const selectedModel = useAppSelector(selectDefaultModel);
  const agentModeSupported = selectedModel && modelSupportsTools(selectedModel);

  const jetbrains = useMemo(() => {
    return isJetBrains();
  }, []);
  const metaKeyLabel = useMemo(() => {
    return getMetaKeyLabel();
  }, []);

  const getModeIcon = (mode: MessageModes) => {
    switch (mode) {
      case "agent":
        return <SparklesIcon className="h-3 w-3" />;
      case "chat":
        return <ChatBubbleLeftIcon className="h-3 w-3" />;
      case "edit":
        return <PencilIcon className="h-3 w-3" />;
    }
  };

  // Switch to chat mode if agent mode is selected but not supported
  useEffect(() => {
    if (mode === "agent" && !agentModeSupported) {
      dispatch(setMode("chat"));
    }
  }, [mode, agentModeSupported, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "." && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dispatch(cycleMode({ isJetBrains: jetbrains }));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, mode, jetbrains]);

  return (
    <Listbox
      value={mode}
      onChange={(newMode) => {
        dispatch(setMode(newMode));
      }}
    >
      <div className="relative">
        <ListboxButton
          data-testid="mode-select-button"
          className="gap-1 rounded-full px-2 py-0.5 text-gray-400 transition-colors duration-200"
          style={{
            backgroundColor: `${lightGray}33`,
          }}
        >
          {getModeIcon(mode)}
          <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-32 max-w-48">
          <ListboxOption value="agent" disabled={!agentModeSupported}>
            <div className="flex flex-row items-center gap-1.5">
              <SparklesIcon className="h-3 w-3" />
              <span className="font-semibold">Agent</span>
            </div>
            {mode === "agent" && <CheckIcon className="ml-auto h-3 w-3" />}
            {!agentModeSupported && <span>(Not supported)</span>}
          </ListboxOption>

          <ListboxOption value="chat">
            <div className="flex flex-row items-center gap-1.5">
              <ChatBubbleLeftIcon className="h-3 w-3" />
              <span className="font-semibold">Chat</span>
              <ShortcutText>{getMetaKeyLabel()}L</ShortcutText>
            </div>
            {mode === "chat" && <CheckIcon className="ml-auto h-3 w-3" />}
          </ListboxOption>

          {!jetbrains && (
            <ListboxOption value="edit">
              <div className="flex flex-row items-center gap-1.5">
                <PencilIcon className="h-3 w-3" />
                <span className="font-semibold">Edit</span>
                <ShortcutText>{getMetaKeyLabel()}I</ShortcutText>
              </div>
              {mode === "edit" && <CheckIcon className="ml-auto h-3 w-3" />}
            </ListboxOption>
          )}

          <div className="text-lightgray px-2 py-1">
            <Shortcut>{metaKeyLabel}</Shortcut>
            <Shortcut>.</Shortcut> for next mode
          </div>
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

export default ModeSelect;
