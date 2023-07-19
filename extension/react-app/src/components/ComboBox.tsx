import React, { useEffect, useImperativeHandle, useState } from "react";
import { useCombobox } from "downshift";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import CodeBlock from "./CodeBlock";
import PillButton from "./PillButton";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { DocumentPlus } from "@styled-icons/heroicons-outline";
import { HighlightedRangeContext } from "../../../schema/FullState";
import { postVscMessage } from "../vscode";
import { getMetaKeyLabel } from "../util";

// #region styled components
const mainInputFontSize = 13;

const EmptyPillDiv = styled.div`
  padding: 8px;
  border-radius: ${defaultBorderRadius};
  border: 1px dashed ${lightGray};
  color: ${lightGray};
  background-color: ${vscBackground};
  overflow: hidden;
  display: flex;
  align-items: center;
  text-align: center;
  cursor: pointer;
  font-size: 13px;

  &:hover {
    background-color: ${lightGray};
    color: ${vscBackground};
  }
`;

const MainTextInput = styled.textarea`
  resize: none;

  padding: 8px;
  font-size: ${mainInputFontSize}px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  margin: 8px auto;
  height: auto;
  width: 100%;
  background-color: ${secondaryDark};
  color: ${vscForeground};
  z-index: 1;
  border: 1px solid transparent;

  &:focus {
    outline: 1px solid ${lightGray};
    border: 1px solid transparent;
  }
`;

const UlMaxHeight = 300;
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
  color: ${vscForeground};
  max-height: ${UlMaxHeight}px;
  width: calc(100% - 16px);
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 0;
  ${({ hidden }) => hidden && "display: none;"}
  border-radius: ${defaultBorderRadius};
  outline: 0.5px solid gray;
  z-index: 2;
  // Get rid of scrollbar and its padding
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    width: 0px;
    background: transparent; /* make scrollbar transparent */
  }
`;

const Li = styled.li<{
  highlighted: boolean;
  selected: boolean;
  isLastItem: boolean;
}>`
  background-color: ${secondaryDark};
  ${({ highlighted }) => highlighted && "background: #ff000066;"}
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
  highlightedCodeSections: HighlightedRangeContext[];
  deleteContextItems: (indices: number[]) => void;
  onTogglePin: () => void;
  onToggleAddContext: () => void;
  addingHighlightedCode: boolean;
}

const ComboBox = React.forwardRef((props: ComboBoxProps, ref) => {
  const [history, setHistory] = React.useState<string[]>([]);
  // The position of the current command you are typing now, so the one that will be appended to history once you press enter
  const [positionInHistory, setPositionInHistory] = React.useState<number>(0);
  const [items, setItems] = React.useState(props.items);
  const [highlightedCodeSections, setHighlightedCodeSections] = React.useState(
    props.highlightedCodeSections || []
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHighlightedCodeSections(props.highlightedCodeSections || []);
  }, [props.highlightedCodeSections]);

  const { getInputProps, ...downshiftProps } = useCombobox({
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

  useImperativeHandle(ref, () => downshiftProps, [downshiftProps]);

  const [metaKeyPressed, setMetaKeyPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        setMetaKeyPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        setMetaKeyPressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }
    inputRef.current.focus();
    const handler = (event: any) => {
      if (event.data.type === "focusContinueInput") {
        inputRef.current!.focus();
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [inputRef.current]);

  const divRef = React.useRef<HTMLDivElement>(null);
  const ulRef = React.useRef<HTMLUListElement>(null);
  const showAbove = () => {
    return (divRef.current?.getBoundingClientRect().top || 0) > UlMaxHeight;
  };

  return (
    <>
      <div className="px-2 flex gap-2 items-center flex-wrap mt-2">
        {/* {highlightedCodeSections.length > 1 && (
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
          </>
        )} */}
        {highlightedCodeSections.map((section, idx) => (
          <PillButton
            warning={
              section.range.contents.length > 4000 && section.editing
                ? "Editing such a large range may be slow"
                : undefined
            }
            onlyShowDelete={
              highlightedCodeSections.length <= 1 || section.editing
            }
            editing={section.editing}
            pinned={section.pinned}
            index={idx}
            key={`${section.display_name}${idx}`}
            title={`${section.display_name} (${
              section.range.range.start.line + 1
            }-${section.range.range.end.line + 1})`}
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
          />
        ))}
        {props.highlightedCodeSections.length > 0 &&
          (props.addingHighlightedCode ? (
            <EmptyPillDiv
              onClick={() => {
                props.onToggleAddContext();
              }}
            >
              Highlight code section
            </EmptyPillDiv>
          ) : (
            <HeaderButtonWithText
              text="Add more code to context"
              onClick={() => {
                props.onToggleAddContext();
              }}
            >
              <DocumentPlus width="1.6em"></DocumentPlus>
            </HeaderButtonWithText>
          ))}
      </div>
      <div className="flex px-2" ref={divRef} hidden={!downshiftProps.isOpen}>
        <MainTextInput
          disabled={props.disabled}
          placeholder={`Ask a question, give instructions, or type '/' to see slash commands`}
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
            onFocus: (e) => {
              setFocused(true);
            },
            onBlur: (e) => {
              setFocused(false);
              postVscMessage("blurContinueInput", {});
            },
            onKeyDown: (event) => {
              if (event.key === "Enter" && event.shiftKey) {
                // Prevent Downshift's default 'Enter' behavior.
                (event.nativeEvent as any).preventDownshiftDefault = true;
              } else if (
                event.key === "Enter" &&
                (!downshiftProps.isOpen || items.length === 0)
              ) {
                const value = downshiftProps.inputValue;
                if (value !== "") {
                  setPositionInHistory(history.length + 1);
                  setHistory([...history, value]);
                }
                // Prevent Downshift's default 'Enter' behavior.
                (event.nativeEvent as any).preventDownshiftDefault = true;

                if (props.onEnter) props.onEnter(event);
              } else if (event.key === "Tab" && items.length > 0) {
                downshiftProps.setInputValue(items[0].name);
                event.preventDefault();
              } else if (
                (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                event.currentTarget.value.split("\n").length > 1
              ) {
                (event.nativeEvent as any).preventDownshiftDefault = true;
              } else if (event.key === "ArrowUp") {
                if (positionInHistory == 0) return;
                else if (
                  positionInHistory == history.length &&
                  (history.length === 0 ||
                    history[history.length - 1] !== event.currentTarget.value)
                ) {
                  setHistory([...history, event.currentTarget.value]);
                }
                downshiftProps.setInputValue(history[positionInHistory - 1]);
                setPositionInHistory((prev) => prev - 1);
              } else if (event.key === "ArrowDown") {
                if (positionInHistory < history.length) {
                  downshiftProps.setInputValue(history[positionInHistory + 1]);
                }
                setPositionInHistory((prev) =>
                  Math.min(prev + 1, history.length)
                );
              }
            },
            ref: inputRef,
          })}
        />
        <Ul
          {...downshiftProps.getMenuProps({
            ref: ulRef,
          })}
          showAbove={showAbove()}
          ulHeightPixels={ulRef.current?.getBoundingClientRect().height || 0}
          hidden={!downshiftProps.isOpen || items.length === 0}
        >
          {downshiftProps.isOpen &&
            items.map((item, index) => (
              <Li
                style={{ borderTop: index === 0 ? "none" : undefined }}
                key={`${item.name}${index}`}
                {...downshiftProps.getItemProps({ item, index })}
                highlighted={downshiftProps.highlightedIndex === index}
                selected={downshiftProps.selectedItem === item}
              >
                <span>
                  {item.name}: {item.description}
                </span>
              </Li>
            ))}
        </Ul>
      </div>
      {highlightedCodeSections.length === 0 &&
        (downshiftProps.inputValue?.startsWith("/edit") ||
          (focused &&
            metaKeyPressed &&
            downshiftProps.inputValue?.length > 0)) && (
          <div className="text-trueGray-400 pr-4 text-xs text-right">
            Inserting at cursor
          </div>
        )}
    </>
  );
});

export default ComboBox;
