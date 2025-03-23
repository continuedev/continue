// A dropdown menu for selecting between Chat, Edit, and Agent modes with keyboard shortcuts
import { Listbox } from "@headlessui/react";
import {
  ChatBubbleLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { useEffect } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscInputBackground } from "..";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectDefaultModel } from "../../redux/slices/configSlice";
import {
  cycleMode,
  selectCurrentMode,
  setMode,
} from "../../redux/slices/sessionSlice";
import { fontSize, getFontSize, getMetaKeyLabel } from "../../util";

const StyledListboxButton = styled(Listbox.Button)`
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

const StyledListboxOptions = styled(Listbox.Options)`
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

const StyledListboxOption = styled(Listbox.Option)`
  border-radius: ${defaultBorderRadius};
  padding: 6px 12px;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};

  &:hover {
    background: ${(props) =>
      props.disabled ? "transparent" : `${lightGray}33`};
  }
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
        dispatch(cycleMode());
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, mode]);

  return (
    <Listbox
      value={mode}
      onChange={(newMode) => {
        dispatch(setMode(newMode));
      }}
    >
      <div className="relative">
        <StyledListboxButton
          data-testid="mode-select-button"
          className="h-[18px] overflow-hidden"
          style={{ padding: 0, fontSize: fontSize(-3) }}
        >
          <div
            style={{
              backgroundColor: `${lightGray}33`,
            }}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-gray-400 transition-colors duration-200"
          >
            {getModeIcon(mode)}
            <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            <ChevronDownIcon
              className="h-2 w-2 flex-shrink-0"
              aria-hidden="true"
            />
          </div>
        </StyledListboxButton>
        <StyledListboxOptions
          className="z-50"
          style={{
            fontSize: fontSize(-3),
          }}
        >
          <StyledListboxOption value="agent" disabled={!agentModeSupported}>
            <SparklesIcon className="h-3 w-3" />
            <span className="font-semibold">Agent</span>
            {/* <ShortcutText></ShortcutText> */}
            {mode === "agent" && <CheckIcon className="ml-auto h-3 w-3" />}
            {!agentModeSupported && <span>(Not supported)</span>}
          </StyledListboxOption>

          <StyledListboxOption value="chat">
            <ChatBubbleLeftIcon className="h-3 w-3" />
            <span className="font-semibold">Chat</span>
            <ShortcutText>{getMetaKeyLabel()}L</ShortcutText>
            {mode === "chat" && <CheckIcon className="ml-auto h-3 w-3" />}
          </StyledListboxOption>
          <StyledListboxOption value="edit">
            <PencilIcon className="h-3 w-3" />
            <span className="font-semibold">Edit</span>
            <ShortcutText>{getMetaKeyLabel()}I</ShortcutText>
            {mode === "edit" && <CheckIcon className="ml-auto h-3 w-3" />}
          </StyledListboxOption>
          <div className="text-lightgray px-2 py-1">
            {getMetaKeyLabel()}
            <span>.</span> for next mode
          </div>
        </StyledListboxOptions>
      </div>
    </Listbox>
  );
}

export default ModeSelect;
