import React, { useCallback, useEffect, useState } from "react";
import { useCombobox } from "downshift";
import styled from "styled-components";
import {
  buttonColor,
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
} from ".";
import CodeBlock from "./CodeBlock";
import { RangeInFile } from "../../../src/client";
import PillButton from "./PillButton";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { Trash, LockClosed, LockOpen } from "@styled-icons/heroicons-outline";

// #region styled components
const mainInputFontSize = 16;

const ContextDropdown = styled.div`
  position: absolute;
  padding: 4px;
  width: calc(100% - 16px - 8px);
  background-color: ${secondaryDark};
  color: white;
  border-bottom-right-radius: ${defaultBorderRadius};
  border-bottom-left-radius: ${defaultBorderRadius};
  /* border: 1px solid white; */
  border-top: none;
  margin: 8px;
  outline: 1px solid orange;
  z-index: 5;
`;

const MainTextInput = styled.textarea`
  resize: none;

  padding: 8px;
  font-size: ${mainInputFontSize}px;
  border-radius: ${defaultBorderRadius};
  border: 1px solid white;
  margin: 8px auto;
  width: 100%;
  background-color: ${vscBackground};
  color: white;
  z-index: 1;

  &:focus {
    border: 1px solid transparent;
    outline: 1px solid orange;
  }
`;

const UlMaxHeight = 200;
const Ul = styled.ul<{
  hidden: boolean;
  showAbove: boolean;
  ulHeightPixels: number;
}>`
  ${(props) =>
    props.showAbove
      ? `transform: translateY(-${props.ulHeightPixels + 8}px);`
      : `transform: translateY(${2 * mainInputFontSize}px);`}
  position: absolute;
  background: ${vscBackground};
  background-color: ${secondaryDark};
  color: white;
  font-family: "Fira Code", monospace;
  max-height: ${UlMaxHeight}px;
  overflow: scroll;
  padding: 0;
  ${({ hidden }) => hidden && "display: none;"}
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
  border: 0.5px solid gray;
  z-index: 2;
`;

const Li = styled.li<{
  highlighted: boolean;
  selected: boolean;
  isLastItem: boolean;
}>`
  ${({ highlighted }) => highlighted && "background: #aa0000;"}
  ${({ selected }) => selected && "font-weight: bold;"}
    padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  ${({ isLastItem }) => isLastItem && "border-bottom: 1px solid gray;"}
  border-top: 1px solid gray;
  cursor: pointer;
`;

// #endregion

interface ComboBoxProps {
  items: { name: string; description: string }[];
  onInputValueChange: (inputValue: string) => void;
  disabled?: boolean;
  onEnter: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  highlightedCodeSections: (RangeInFile & { contents: string })[];
  deleteContextItems: (indices: number[]) => void;
  onTogglePin: () => void;
}

const ComboBox = React.forwardRef((props: ComboBoxProps, ref) => {
  const [history, setHistory] = React.useState<string[]>([]);
  // The position of the current command you are typing now, so the one that will be appended to history once you press enter
  const [positionInHistory, setPositionInHistory] = React.useState<number>(0);
  const [items, setItems] = React.useState(props.items);
  const [hoveringButton, setHoveringButton] = React.useState(false);
  const [hoveringContextDropdown, setHoveringContextDropdown] =
    React.useState(false);
  const [pinned, setPinned] = useState(false);
  const [highlightedCodeSections, setHighlightedCodeSections] = React.useState(
    props.highlightedCodeSections || [
      {
        filepath: "test.ts",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        contents: "import * as a from 'a';",
      },
    ]
  );

  useEffect(() => {
    setHighlightedCodeSections(props.highlightedCodeSections || []);
  }, [props.highlightedCodeSections]);

  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    selectedItem,
    setInputValue,
  } = useCombobox({
    onInputValueChange({ inputValue }) {
      if (!inputValue) return;
      props.onInputValueChange(inputValue);
      setItems(
        props.items.filter((item) =>
          item.name.toLowerCase().startsWith(inputValue.toLowerCase())
        )
      );
    },
    items,
    itemToString(item) {
      return item ? item.name : "";
    },
  });

  const divRef = React.useRef<HTMLDivElement>(null);
  const ulRef = React.useRef<HTMLUListElement>(null);
  const showAbove = () => {
    return (divRef.current?.getBoundingClientRect().top || 0) > UlMaxHeight;
  };

  return (
    <>
      <div className="flex px-2" ref={divRef} hidden={!isOpen}>
        <MainTextInput
          disabled={props.disabled}
          placeholder="Ask a question, give instructions, or type '/' to see slash commands"
          {...getInputProps({
            onChange: (e) => {
              const target = e.target as HTMLTextAreaElement;
              // Update the height of the textarea to match the content, up to a max of 200px.
              target.style.height = "auto";
              target.style.height = `${Math.min(
                target.scrollHeight,
                300
              ).toString()}px`;

              // setShowContextDropdown(target.value.endsWith("@"));
            },
            onKeyDown: (event) => {
              if (event.key === "Enter" && event.shiftKey) {
                // Prevent Downshift's default 'Enter' behavior.
                (event.nativeEvent as any).preventDownshiftDefault = true;
              } else if (
                event.key === "Enter" &&
                (!isOpen || items.length === 0)
              ) {
                // Prevent Downshift's default 'Enter' behavior.
                (event.nativeEvent as any).preventDownshiftDefault = true;
                if (props.onEnter) props.onEnter(event);
                setInputValue("");
                const value = event.currentTarget.value;
                if (value !== "") {
                  setPositionInHistory(history.length + 1);
                  setHistory([...history, value]);
                }
              } else if (event.key === "Tab" && items.length > 0) {
                setInputValue(items[0].name);
                event.preventDefault();
              } else if (
                event.key === "ArrowUp" ||
                (event.key === "ArrowDown" &&
                  event.currentTarget.value.split("\n").length > 1)
              ) {
                (event.nativeEvent as any).preventDownshiftDefault = true;
              } else if (
                event.key === "ArrowUp" &&
                event.currentTarget.value.split("\n").length > 1
              ) {
                if (positionInHistory == 0) return;
                setInputValue(history[positionInHistory - 1]);
                setPositionInHistory((prev) => prev - 1);
              } else if (
                event.key === "ArrowDown" &&
                event.currentTarget.value.split("\n").length > 1
              ) {
                if (positionInHistory < history.length - 1) {
                  setInputValue(history[positionInHistory + 1]);
                }
                setPositionInHistory((prev) =>
                  Math.min(prev + 1, history.length)
                );
              }
            },
            ref: ref as any,
          })}
        />
        <Ul
          {...getMenuProps({
            ref: ulRef,
          })}
          showAbove={showAbove()}
          ulHeightPixels={ulRef.current?.getBoundingClientRect().height || 0}
        >
          {isOpen &&
            items.map((item, index) => (
              <Li
                key={`${item.name}${index}`}
                {...getItemProps({ item, index })}
                highlighted={highlightedIndex === index}
                selected={selectedItem === item}
              >
                <span>
                  {item.name}: {item.description}
                </span>
              </Li>
            ))}
        </Ul>
      </div>
      <div className="px-2 flex gap-2 items-center flex-wrap">
        {highlightedCodeSections.length > 0 && (
          <>
            <HeaderButtonWithText
              text="Clear Context"
              onClick={() => {
                props.deleteContextItems(
                  highlightedCodeSections.map((_, idx) => idx)
                );
              }}
            >
              <Trash size="1.6em" />
            </HeaderButtonWithText>
            <HeaderButtonWithText
              text={pinned ? "Unpin Context" : "Pin Context"}
              inverted={pinned}
              onClick={() => {
                setPinned((prev) => !prev);
                props.onTogglePin();
              }}
            >
              {pinned ? (
                <LockClosed size="1.6em"></LockClosed>
              ) : (
                <LockOpen size="1.6em"></LockOpen>
              )}
            </HeaderButtonWithText>
          </>
        )}
        {highlightedCodeSections.map((section, idx) => (
          <PillButton
            title={`${section.filepath} (${section.range.start.line + 1}-${
              section.range.end.line + 1
            })`}
            onDelete={() => {
              if (props.deleteContextItems) {
                props.deleteContextItems([idx]);
              }
              setHighlightedCodeSections((prev) => {
                const newSections = [...prev];
                newSections.splice(idx, 1);
                return newSections;
              });
            }}
            onHover={(val: boolean) => {
              if (val) {
                setHoveringButton(val);
              } else {
                setTimeout(() => {
                  setHoveringButton(val);
                }, 100);
              }
            }}
          />
        ))}

        <span className="text-trueGray-400 ml-auto mr-4 text-xs">
          Highlight code to include as context.{" "}
          {highlightedCodeSections.length === 0 &&
            "Otherwise using entire currently open file."}
        </span>
      </div>
      <ContextDropdown
        onMouseEnter={() => {
          setHoveringContextDropdown(true);
        }}
        onMouseLeave={() => {
          setHoveringContextDropdown(false);
        }}
        hidden={true || (!hoveringContextDropdown && !hoveringButton)}
      >
        {highlightedCodeSections.map((section, idx) => (
          <>
            <p>{section.filepath}</p>
            <CodeBlock showCopy={false} key={idx}>
              {section.contents}
            </CodeBlock>
          </>
        ))}
      </ContextDropdown>
    </>
  );
});

export default ComboBox;
