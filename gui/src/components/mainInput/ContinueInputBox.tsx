import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled, { keyframes } from "styled-components";
import {
  buttonColor,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from "..";
import { RootStore } from "../../redux/store";
import { getFontSize } from "../../util";
import InputDropdown from "./InputDropdown";
import InputToolbar from "./InputToolbar";
import { ComboBoxItem, DropdownState } from "./types";

const mainInputFontSize = getFontSize();

const gradient = keyframes`
  0% {
    background-position: 0px 0;
  }
  100% {
    background-position: 100em 0;
  }
`;

const GradientBorder = styled.div<{
  borderRadius?: string;
  borderColor?: string;
  isFirst: boolean;
  isLast: boolean;
  loading: boolean;
}>`
  border-radius: ${(props) => props.borderRadius || "0"};
  padding: 1px;
  background: ${(props) =>
    props.borderColor
      ? props.borderColor
      : `repeating-linear-gradient(
      101.79deg,
      #1BBE84 0%,
      #331BBE 16%,
      #BE1B55 33%,
      #A6BE1B 55%,
      #BE1B55 67%,
      #331BBE 85%,
      #1BBE84 99%
    )`};
  animation: ${(props) => (props.loading ? gradient : "")} 6s linear infinite;
  background-size: 200% 200%;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 8px;
`;

const InputBoxDiv = styled.div<{
  inQueryForDynamicProvider: boolean;
  fontSize?: number;
}>`
  resize: none;

  padding: 8px;
  padding-bottom: 24px;
  font-size: ${(props) => props.fontSize || mainInputFontSize}px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  margin: 0;
  height: auto;
  width: 100%;
  background-color: ${secondaryDark};
  color: ${vscForeground};
  z-index: 1;
  border: 0.5px solid
    ${(props) => (props.inQueryForDynamicProvider ? buttonColor : lightGray)};
  outline: none;

  &:focus {
    border: 0.5px solid
      ${(props) => (props.inQueryForDynamicProvider ? buttonColor : lightGray)};
    outline: none;
    background-color: ${(props) =>
      props.inQueryForDynamicProvider ? `${buttonColor}22` : secondaryDark};
  }

  &::placeholder {
    color: ${lightGray}cc;
  }

  position: relative;
`;

interface ContinueInputBoxProps {
  isLastUserInput: boolean;
  isMainInput?: boolean;
}

function ContinueInputBox(props: ContinueInputBoxProps) {
  const dispatch = useDispatch();

  const active = useSelector((store: RootStore) => store.state.active);
  const availableSlashCommands = useSelector(
    (state: RootStore) =>
      state.state.config.slashCommands?.map((cmd) => {
        return {
          title: `/${cmd.name}`,
          description: cmd.description,
        };
      }) || []
  );
  const availableContextProviders = useSelector(
    (store: RootStore) => store.state.config.contextProviders
  );

  const [inputFocused, setInputFocused] = useState(false);
  const [dropdownState, setDropdownState] = useState<DropdownState>("closed");
  const [dropdownQuery, setDropdownQuery] = useState("");
  const [dropdownItems, setDropdownItems] = useState<ComboBoxItem[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputBoxRef = useRef<HTMLDivElement>(null);

  // State transitions
  useEffect(() => {
    switch (dropdownState) {
      case "closed":
        setDropdownQuery("");
        break;
      case "contextProviders":
        setDropdownQuery("");
        break;
      case "slashCommands":
        setDropdownQuery("");
        break;
      case "files":
        break;
      default:
        break;
    }
  }, [dropdownState]);

  // Filter dropdown items
  useEffect(() => {
    switch (dropdownState) {
      case "closed":
        setDropdownItems([]);
        break;
      case "contextProviders":
        const filteredItems =
          availableContextProviders
            ?.filter(
              (provider) =>
                provider.description.title
                  .toLowerCase()
                  .startsWith(dropdownQuery.toLowerCase()) ||
                provider.description.displayTitle
                  .toLowerCase()
                  .startsWith(dropdownQuery.toLowerCase())
            )
            .map((provider) => ({
              name: provider.description.displayTitle,
              description: provider.description.description,
              id: provider.description.title,
              title: provider.description.displayTitle,
            }))
            .sort((c, _) => (c.id === "file" ? -1 : 1)) || [];
        setDropdownItems(filteredItems);
        break;
      case "slashCommands":
        const filteredSlashCommands =
          availableSlashCommands?.filter((slashCommand) => {
            const sc = slashCommand.title.toLowerCase().substring(1);
            const iv = dropdownQuery.toLowerCase();
            return sc.startsWith(iv);
          }) || [];
        setDropdownItems(filteredSlashCommands);
        break;
      case "files":
        break;
      default:
        break;
    }
  }, [dropdownQuery, dropdownState]);

  const selectItem = (item: ComboBoxItem) => {
    if (dropdownState === "closed" || !inputBoxRef.current) return;

    switch (dropdownState) {
      case "contextProviders":
        // Delete everything after @
        const text = inputBoxRef.current.innerText;
        const beforeAt = text.substring(0, text.lastIndexOf("@"));
        inputBoxRef.current.innerText = beforeAt;
        break;
      case "slashCommands":
        break;
      case "files":
        break;
      default:
        break;
    }

    setDropdownState("closed");
  };

  return (
    <div
      style={{
        paddingTop: "4px",
        backgroundColor: vscBackground,
      }}
    >
      {/** Input Box */}
      <div
        className="flex px-2 relative"
        style={{
          backgroundColor: vscBackground,
        }}
      >
        <GradientBorder
          loading={active && props.isLastUserInput}
          isFirst={false}
          isLast={false}
          borderColor={
            active && props.isLastUserInput ? undefined : vscBackground
          }
          borderRadius={defaultBorderRadius}
        >
          <InputBoxDiv
            inQueryForDynamicProvider={false}
            fontSize={mainInputFontSize}
            contentEditable="true"
            placeholder="Ask anything"
            onFocus={() => {
              setInputFocused(true);
            }}
            onBlur={(e) => {
              setInputFocused(false);
              setDropdownState("closed");
            }}
            onInput={(e) => {
              if (!inputBoxRef.current) return;

              switch (dropdownState) {
                case "closed":
                  if (inputBoxRef.current.innerText.endsWith("@")) {
                    setDropdownState("contextProviders");
                  } else if (inputBoxRef.current.innerText.endsWith("/")) {
                    setDropdownState("slashCommands");
                  }
                  break;
                case "contextProviders":
                  const text = inputBoxRef.current.innerText;
                  const afterAt = text.substring(text.lastIndexOf("@") + 1);
                  if (afterAt === "") {
                    setDropdownState("closed");
                  } else {
                    setDropdownQuery(afterAt);
                  }
                  break;
                case "slashCommands":
                  const text2 = inputBoxRef.current.innerText;
                  const afterSlash = text2.substring(
                    text2.lastIndexOf("/") + 1
                  );
                  if (afterSlash === "") {
                    setDropdownState("closed");
                  } else {
                    setDropdownQuery(afterSlash);
                  }
                  break;
                case "files":
                  break;
                default:
                  break;
              }
            }}
            ref={inputBoxRef}
            onKeyDown={(e) => {
              if (dropdownState !== "closed") {
                // Handle key presses within dropdown
                if (e.key === "Escape") {
                  setDropdownState("closed");
                } else if (e.key === "ArrowDown") {
                  setHighlightedIndex((prev) =>
                    Math.min(prev + 1, dropdownItems.length - 1)
                  );
                } else if (e.key === "ArrowUp") {
                  setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter") {
                  selectItem(dropdownItems[highlightedIndex]);
                  e.preventDefault();
                }
              }
            }}
          ></InputBoxDiv>

          <InputToolbar
            hidden={!(inputFocused || props.isMainInput)}
            onAddContextItem={() => {
              if (inputBoxRef.current) {
                if (!inputBoxRef.current.innerText.endsWith("@")) {
                  inputBoxRef.current.innerText += "@";
                }
                if (dropdownState === "contextProviders") {
                  setDropdownState("closed");
                } else {
                  setDropdownState("contextProviders");
                }
                // move cursor to end
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(inputBoxRef.current, 1);
                range.collapse(true);
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }}
          />
        </GradientBorder>
        <InputDropdown
          isMainInput={props.isMainInput || false}
          showAbove={false}
          dropdownState={dropdownState}
          items={dropdownItems}
          highlightedIndex={highlightedIndex}
        />
      </div>
    </div>
  );
}

export default ContinueInputBox;
