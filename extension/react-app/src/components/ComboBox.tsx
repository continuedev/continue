import React, {
  useContext,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useCombobox } from "downshift";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import PillButton from "./PillButton";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { DocumentPlus } from "@styled-icons/heroicons-outline";
import { ContextItem } from "../../../schema/FullState";
import { postVscMessage } from "../vscode";
import { GUIClientContext } from "../App";
import { MeiliSearch } from "meilisearch";
import {
  setBottomMessage,
  setBottomMessageCloseTimeout,
} from "../redux/slices/uiStateSlice";
import { useDispatch } from "react-redux";

const SEARCH_INDEX_NAME = "continue_context_items";

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
  inputBoxHeight?: string;
}>`
  ${(props) =>
    props.showAbove
      ? `transform: translateY(-${props.ulHeightPixels + 8}px);`
      : `transform: translateY(${5 * mainInputFontSize}px);`}
  position: absolute;
  background: ${vscBackground};
  color: ${vscForeground};
  max-height: ${UlMaxHeight}px;
  width: calc(100% - 16px);
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 0;
  ${({ hidden }) => hidden && "display: none;"}
  border-radius: ${defaultBorderRadius};
  outline: 1px solid ${lightGray};
  z-index: 2;
  -ms-overflow-style: none;
`;

const Li = styled.li<{
  highlighted: boolean;
  selected: boolean;
  isLastItem: boolean;
}>`
  background-color: ${({ highlighted }) =>
    highlighted ? lightGray : secondaryDark};
  ${({ highlighted }) => highlighted && `background: ${vscBackground};`}
  ${({ selected }) => selected && "font-weight: bold;"}
    padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  ${({ isLastItem }) => isLastItem && "border-bottom: 1px solid gray;"}
  /* border-top: 1px solid gray; */
  cursor: pointer;
`;

// #endregion

interface ComboBoxProps {
  items: { name: string; description: string; id?: string }[];
  onInputValueChange: (inputValue: string) => void;
  disabled?: boolean;
  onEnter: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  selectedContextItems: ContextItem[];
  onToggleAddContext: () => void;
  addingHighlightedCode: boolean;
}

const ComboBox = React.forwardRef((props: ComboBoxProps, ref) => {
  const searchClient = new MeiliSearch({ host: "http://127.0.0.1:7700" });
  const client = useContext(GUIClientContext);
  const dispatch = useDispatch();

  const [history, setHistory] = React.useState<string[]>([]);
  // The position of the current command you are typing now, so the one that will be appended to history once you press enter
  const [positionInHistory, setPositionInHistory] = React.useState<number>(0);
  const [items, setItems] = React.useState(props.items);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputBoxHeight, setInputBoxHeight] = useState<string | undefined>(
    undefined
  );

  // Whether the current input follows an '@' and should be treated as context query
  const [currentlyInContextQuery, setCurrentlyInContextQuery] = useState(false);

  const { getInputProps, ...downshiftProps } = useCombobox({
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem?.id) {
        // Get the query from the input value
        const segs = downshiftProps.inputValue.split("@");
        const query = segs[segs.length - 1];
        const restOfInput = segs.splice(0, segs.length - 1).join("@");

        // Tell server the context item was selected
        client?.selectContextItem(selectedItem.id, query);

        // Remove the '@' and the context query from the input
        if (downshiftProps.inputValue.includes("@")) {
          downshiftProps.setInputValue(restOfInput);
        }
      }
    },
    onInputValueChange({ inputValue, highlightedIndex }) {
      if (!inputValue) {
        setItems([]);
        return;
      }
      props.onInputValueChange(inputValue);

      if (inputValue.endsWith("@") || currentlyInContextQuery) {
        const segs = inputValue?.split("@") || [];

        if (segs.length > 1) {
          // Get search results and return
          setCurrentlyInContextQuery(true);
          const providerAndQuery = segs[segs.length - 1] || "";
          const [provider, query] = providerAndQuery.split(" ");
          searchClient
            .index(SEARCH_INDEX_NAME)
            .search(providerAndQuery)
            .then((res) => {
              setItems(
                res.hits.map((hit) => {
                  return {
                    name: hit.name,
                    description: hit.description,
                    id: hit.id,
                  };
                })
              );
            })
            .catch(() => {
              // Swallow errors, because this simply is not supported on Windows at the moment
            });
          return;
        } else {
          // Exit the '@' context menu
          setCurrentlyInContextQuery(false);
          setItems;
        }
      }
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

  useEffect(() => {
    if (downshiftProps.highlightedIndex < 0) {
      downshiftProps.setHighlightedIndex(0);
    }
  }, [downshiftProps.inputValue]);

  const divRef = React.useRef<HTMLDivElement>(null);
  const ulRef = React.useRef<HTMLUListElement>(null);
  const showAbove = () => {
    return (divRef.current?.getBoundingClientRect().top || 0) > UlMaxHeight;
  };

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
      } else if (event.data.type === "focusContinueInputWithEdit") {
        inputRef.current!.focus();

        downshiftProps.setInputValue("/edit ");
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [inputRef.current]);

  return (
    <>
      <div className="px-2 flex gap-2 items-center flex-wrap mt-2">
        {props.selectedContextItems.map((item, idx) => {
          return (
            <PillButton
              key={`${item.description.id.item_id}${idx}`}
              item={item}
              warning={
                item.content.length > 4000 && item.editing
                  ? "Editing such a large range may be slow"
                  : undefined
              }
              addingHighlightedCode={props.addingHighlightedCode}
              index={idx}
            />
          );
        })}
        {props.selectedContextItems.length > 0 &&
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
          placeholder={`Ask a question, give instructions, type '/' for slash commands, or '@' to add context`}
          {...getInputProps({
            onChange: (e) => {
              const target = e.target as HTMLTextAreaElement;
              // Update the height of the textarea to match the content, up to a max of 200px.
              target.style.height = "auto";
              target.style.height = `${Math.min(
                target.scrollHeight,
                300
              ).toString()}px`;
              setInputBoxHeight(target.style.height);

              // setShowContextDropdown(target.value.endsWith("@"));
            },
            onFocus: (e) => {
              setFocused(true);
              dispatch(setBottomMessage(undefined));
            },
            onBlur: (e) => {
              setFocused(false);
              postVscMessage("blurContinueInput", {});
            },
            onKeyDown: (event) => {
              dispatch(setBottomMessage(undefined));
              if (event.key === "Enter" && event.shiftKey) {
                // Prevent Downshift's default 'Enter' behavior.
                (event.nativeEvent as any).preventDownshiftDefault = true;
                setCurrentlyInContextQuery(false);
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
                setCurrentlyInContextQuery(false);
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
                setCurrentlyInContextQuery(false);
              } else if (event.key === "ArrowDown") {
                if (positionInHistory < history.length) {
                  downshiftProps.setInputValue(history[positionInHistory + 1]);
                }
                setPositionInHistory((prev) =>
                  Math.min(prev + 1, history.length)
                );
                setCurrentlyInContextQuery(false);
              }
            },
            onClick: () => {
              dispatch(setBottomMessage(undefined));
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
                  {item.name}:{"  "}
                  <span style={{ color: lightGray }}>{item.description}</span>
                </span>
              </Li>
            ))}
        </Ul>
      </div>
      {props.selectedContextItems.length === 0 &&
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
