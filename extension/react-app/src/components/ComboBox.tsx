import React, {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useCombobox } from "downshift";
import styled from "styled-components";
import {
  StyledTooltip,
  buttonColor,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import PillButton from "./PillButton";
import HeaderButtonWithText from "./HeaderButtonWithText";
import {
  BookmarkIcon,
  DocumentPlusIcon,
  FolderArrowDownIcon,
  ArrowLeftIcon,
  PlusIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { ContextItem } from "../../../schema/FullState";
import { postVscMessage } from "../vscode";
import { GUIClientContext } from "../App";
import { MeiliSearch } from "meilisearch";
import {
  setBottomMessage,
  setDialogMessage,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import SelectContextGroupDialog from "./dialogs/SelectContextGroupDialog";
import AddContextGroupDialog from "./dialogs/AddContextGroupDialog";

const SEARCH_INDEX_NAME = "continue_context_items";

// #region styled components
const mainInputFontSize = 13;

const EmptyPillDiv = styled.div`
  padding: 4px;
  padding-left: 8px;
  padding-right: 8px;
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

const MainTextInput = styled.textarea<{ inQueryForDynamicProvider: boolean }>`
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
  border: 1px solid
    ${(props) =>
      props.inQueryForDynamicProvider ? buttonColor : "transparent"};

  &:focus {
    outline: 1px solid
      ${(props) => (props.inQueryForDynamicProvider ? buttonColor : lightGray)};
    border: 1px solid transparent;
    background-color: ${(props) =>
      props.inQueryForDynamicProvider ? `${buttonColor}22` : secondaryDark};
  }

  &::placeholder {
    color: ${lightGray}80;
  }
`;

const DynamicQueryTitleDiv = styled.div`
  position: absolute;
  right: 0px;
  top: 0px;
  height: fit-content;
  padding: 2px 4px;
  border-radius: ${defaultBorderRadius};
  z-index: 2;
  color: white;
  font-size: 12px;

  background-color: ${buttonColor};
`;

const StyledPlusIcon = styled(PlusIcon)`
  position: absolute;
  right: 0px;
  top: 0px;
  height: fit-content;
  padding: 0;
  cursor: pointer;
  border-radius: ${defaultBorderRadius};
  z-index: 2;

  background-color: ${vscBackground};

  &:hover {
    background-color: ${secondaryDark};
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

  scrollbar-width: none; /* Firefox */

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }
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
  flex-direction: row;
  align-items: center;
  ${({ isLastItem }) => isLastItem && "border-bottom: 1px solid gray;"}
  /* border-top: 1px solid gray; */
  cursor: pointer;
`;

// #endregion

interface ComboBoxProps {
  items: { name: string; description: string; id?: string; content?: string }[];
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
  const workspacePaths = useSelector(
    (state: RootStore) => state.config.workspacePaths
  );
  const savedContextGroups = useSelector(
    (state: RootStore) => state.serverState.saved_context_groups
  );

  const [history, setHistory] = React.useState<string[]>([]);
  // The position of the current command you are typing now, so the one that will be appended to history once you press enter
  const [positionInHistory, setPositionInHistory] = React.useState<number>(0);
  const [items, setItems] = React.useState(props.items);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Whether the current input follows an '@' and should be treated as context query
  const [currentlyInContextQuery, setCurrentlyInContextQuery] = useState(false);
  const [nestedContextProvider, setNestedContextProvider] = useState<
    any | undefined
  >(undefined);
  const [inQueryForContextProvider, setInQueryForContextProvider] = useState<
    any | undefined
  >(undefined);

  useEffect(() => {
    if (!currentlyInContextQuery) {
      setNestedContextProvider(undefined);
      setInQueryForContextProvider(undefined);
    }
  }, [currentlyInContextQuery]);

  const contextProviders = useSelector(
    (state: RootStore) => state.serverState.context_providers
  ) as any[];

  const goBackToContextProviders = () => {
    setCurrentlyInContextQuery(false);
    setNestedContextProvider(undefined);
    setInQueryForContextProvider(undefined);
    downshiftProps.setInputValue("@");
  };

  useEffect(() => {
    if (!nestedContextProvider) {
      console.log("setting items", nestedContextProvider);
      setItems(
        contextProviders?.map((provider) => ({
          name: provider.display_title,
          description: provider.description,
          id: provider.title,
        })) || []
      );
    }
  }, [nestedContextProvider]);

  const onInputValueChangeCallback = useCallback(
    ({ inputValue, highlightedIndex }: any) => {
      // Clear the input
      if (!inputValue) {
        setItems([]);
        setNestedContextProvider(undefined);
        setCurrentlyInContextQuery(false);
        return;
      }
      if (
        inQueryForContextProvider &&
        !inputValue.startsWith(`@${inQueryForContextProvider.title}`)
      ) {
        setInQueryForContextProvider(undefined);
      }

      props.onInputValueChange(inputValue);

      // Handle context selection
      if (inputValue.endsWith("@") || currentlyInContextQuery) {
        const segs = inputValue?.split("@") || [];

        if (segs.length > 1) {
          // Get search results and return
          setCurrentlyInContextQuery(true);
          const providerAndQuery = segs[segs.length - 1] || "";

          if (nestedContextProvider && !inputValue.endsWith("@")) {
            // Search only within this specific context provider
            getFilteredContextItemsForProvider(
              nestedContextProvider.title,
              providerAndQuery
            ).then((res) => {
              setItems(res);
            });
          } else {
            // Search through the list of context providers
            const filteredItems =
              contextProviders
                ?.filter(
                  (provider) =>
                    `@${provider.title}`
                      .toLowerCase()
                      .startsWith(inputValue.toLowerCase()) ||
                    `@${provider.display_title}`
                      .toLowerCase()
                      .startsWith(inputValue.toLowerCase())
                )
                .map((provider) => ({
                  name: provider.display_title,
                  description: provider.description,
                  id: provider.title,
                })) || [];
            setItems(filteredItems);
            setCurrentlyInContextQuery(true);
          }
          return;
        } else {
          // Exit the '@' context menu
          setCurrentlyInContextQuery(false);
          setNestedContextProvider(undefined);
        }
      }

      setNestedContextProvider(undefined);

      // Handle slash commands
      setItems(
        props.items.filter((item) =>
          item.name.toLowerCase().startsWith(inputValue.toLowerCase())
        )
      );
    },
    [
      props.items,
      currentlyInContextQuery,
      nestedContextProvider,
      inQueryForContextProvider,
    ]
  );

  const onSelectedItemChangeCallback = useCallback(
    ({ selectedItem }: any) => {
      if (!selectedItem) return;
      if (selectedItem.id) {
        // Get the query from the input value
        const segs = downshiftProps.inputValue.split("@");
        const query = segs[segs.length - 1];

        // Tell server the context item was selected
        client?.selectContextItem(selectedItem.id, query);
        if (downshiftProps.inputValue.includes("@")) {
          const selectedNestedContextProvider = contextProviders.find(
            (provider) => provider.title === selectedItem.id
          );
          if (
            !nestedContextProvider &&
            !selectedNestedContextProvider?.dynamic
          ) {
            downshiftProps.setInputValue(`@${selectedItem.id} `);
            setNestedContextProvider(selectedNestedContextProvider);
          } else {
            downshiftProps.setInputValue("");
          }
        }
      }
    },
    [nestedContextProvider, contextProviders, client]
  );

  const getFilteredContextItemsForProvider = async (
    provider: string,
    query: string
  ) => {
    // Only return context items from the current workspace - the index is currently shared between all sessions
    const workspaceFilter =
      workspacePaths && workspacePaths.length > 0
        ? `workspace_dir IN [ ${workspacePaths
            .map((path) => `"${path}"`)
            .join(", ")} ] AND provider_name = '${provider}'`
        : undefined;
    try {
      const res = await searchClient.index(SEARCH_INDEX_NAME).search(query, {
        filter: workspaceFilter,
      });
      return (
        res?.hits.map((hit) => {
          return {
            name: hit.name,
            description: hit.description,
            id: hit.id,
            content: hit.content,
          };
        }) || []
      );
    } catch (e) {
      console.log("Error searching context items", e);
      return [];
    }
  };

  const { getInputProps, ...downshiftProps } = useCombobox({
    onSelectedItemChange: onSelectedItemChangeCallback,
    onInputValueChange: onInputValueChangeCallback,
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
    return (
      (divRef.current?.getBoundingClientRect().top || Number.MAX_SAFE_INTEGER) >
      UlMaxHeight
    );
  };

  useImperativeHandle(ref, () => downshiftProps, [downshiftProps]);

  const contextItemsDivRef = React.useRef<HTMLDivElement>(null);
  const handleTabPressed = () => {
    // Set the focus to the next item in the context items div
    if (!contextItemsDivRef.current) {
      return;
    }
    const focusableItems =
      contextItemsDivRef.current.querySelectorAll(".pill-button");
    const focusableItemsArray = Array.from(focusableItems);
    const focusedItemIndex = focusableItemsArray.findIndex(
      (item) => item === document.activeElement
    );
    console.log(focusedItemIndex, focusableItems);
    if (focusedItemIndex === focusableItemsArray.length - 1) {
      inputRef.current?.focus();
    } else if (focusedItemIndex !== -1) {
      const nextItem =
        focusableItemsArray[
          (focusedItemIndex + 1) % focusableItemsArray.length
        ];
      (nextItem as any)?.focus();
    } else {
      const firstItem = focusableItemsArray[0];
      (firstItem as any)?.focus();
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const listener = (e: any) => {
        if (e.key === "Tab") {
          e.preventDefault();
          handleTabPressed();
        }
      };
      window.addEventListener("keydown", listener);
      return () => {
        window.removeEventListener("keydown", listener);
      };
    }
  }, []);

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

  const selectContextItemFromDropdown = useCallback(
    (event: any) => {
      const newProviderName = items[downshiftProps.highlightedIndex].name;
      const newProvider = contextProviders.find(
        (provider) => provider.display_title === newProviderName
      );

      if (!newProvider) {
        (event.nativeEvent as any).preventDownshiftDefault = true;
        return;
      } else if (newProvider.dynamic && newProvider.requires_query) {
        setInQueryForContextProvider(newProvider);
        downshiftProps.setInputValue(`@${newProvider.title} `);
        (event.nativeEvent as any).preventDownshiftDefault = true;
        event.preventDefault();
        return;
      } else if (newProvider.dynamic) {
        return;
      }

      setNestedContextProvider(newProvider);
      downshiftProps.setInputValue(`@${newProvider.title} `);
      (event.nativeEvent as any).preventDownshiftDefault = true;
      event.preventDefault();
      getFilteredContextItemsForProvider(newProvider.title, "").then((items) =>
        setItems(items)
      );
    },
    [
      items,
      downshiftProps.highlightedIndex,
      contextProviders,
      nestedContextProvider,
    ]
  );

  const showSelectContextGroupDialog = () => {
    dispatch(setDialogMessage(<SelectContextGroupDialog />));
    dispatch(setShowDialog(true));
  };

  const showDialogToSaveContextGroup = () => {
    dispatch(
      setDialogMessage(
        <AddContextGroupDialog
          selectedContextItems={props.selectedContextItems}
        />
      )
    );
    dispatch(setShowDialog(true));
  };

  const [isComposing, setIsComposing] = useState(false);

  return (
    <>
      <div
        className="px-2 flex gap-2 items-center flex-wrap mt-2"
        ref={contextItemsDivRef}
      >
        {props.selectedContextItems.map((item, idx) => {
          return (
            <PillButton
              areMultipleItems={props.selectedContextItems.length > 1}
              key={`${item.description.id.item_id}${idx}`}
              item={item}
              warning={
                item.content.length > 4000 && item.editing
                  ? "Editing such a large range may be slow"
                  : undefined
              }
              addingHighlightedCode={props.addingHighlightedCode}
              index={idx}
              onDelete={() => {
                client?.deleteContextWithIds([item.description.id]);
                inputRef.current?.focus();
              }}
            />
          );
        })}
        <HeaderButtonWithText
          text="Load bookmarked context"
          onClick={() => {
            showSelectContextGroupDialog();
          }}
          className="pill-button focus:outline-none focus:border-red-600 focus:border focus:border-solid"
          onKeyDown={(e: KeyboardEvent) => {
            e.preventDefault();
            if (e.key === "Enter") {
              showSelectContextGroupDialog();
            }
          }}
        >
          <FolderArrowDownIcon width="1.4em" height="1.4em" />
        </HeaderButtonWithText>
        {props.selectedContextItems.length > 0 && (
          <>
            {props.addingHighlightedCode ? (
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
                className="pill-button focus:outline-none focus:border-red-600 focus:border focus:border-solid"
                onKeyDown={(e: KeyboardEvent) => {
                  e.preventDefault();
                  if (e.key === "Enter") {
                    props.onToggleAddContext();
                  }
                }}
              >
                <DocumentPlusIcon width="1.4em" height="1.4em" />
              </HeaderButtonWithText>
            )}
            <HeaderButtonWithText
              text="Bookmark context"
              onClick={() => {
                showDialogToSaveContextGroup();
              }}
              className="pill-button focus:outline-none focus:border-red-600 focus:border focus:border-solid"
              onKeyDown={(e: KeyboardEvent) => {
                e.preventDefault();
                if (e.key === "Enter") {
                  showDialogToSaveContextGroup();
                }
              }}
            >
              <BookmarkIcon width="1.4em" height="1.4em" />
            </HeaderButtonWithText>
          </>
        )}
      </div>
      <div
        className="flex px-2 relative"
        ref={divRef}
        hidden={!downshiftProps.isOpen}
      >
        <MainTextInput
          inQueryForDynamicProvider={
            typeof inQueryForContextProvider !== "undefined"
          }
          disabled={props.disabled}
          placeholder={`Ask a question, give instructions, type '/' for slash commands, or '@' to add context`}
          {...getInputProps({
            onCompositionStart: () => setIsComposing(true),
            onCompositionEnd: () => setIsComposing(false),
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
              dispatch(setBottomMessage(undefined));
            },
            onKeyDown: (event) => {
              dispatch(setBottomMessage(undefined));
              if (event.key === "Enter" && event.shiftKey) {
                // Prevent Downshift's default 'Enter' behavior.
                (event.nativeEvent as any).preventDownshiftDefault = true;
                setCurrentlyInContextQuery(false);
              } else if (
                event.key === "Enter" &&
                (!downshiftProps.isOpen || items.length === 0) &&
                !isComposing
              ) {
                const value = downshiftProps.inputValue;
                if (inQueryForContextProvider) {
                  const segs = value.split("@");
                  client?.selectContextItem(
                    inQueryForContextProvider.title,
                    segs[segs.length - 1]
                  );
                  setCurrentlyInContextQuery(false);
                  downshiftProps.setInputValue("");
                  return;
                } else {
                  if (value !== "") {
                    setPositionInHistory(history.length + 1);
                    setHistory([...history, value]);
                  }
                  // Prevent Downshift's default 'Enter' behavior.
                  (event.nativeEvent as any).preventDownshiftDefault = true;

                  if (props.onEnter) {
                    props.onEnter(event);
                  }
                }
                setCurrentlyInContextQuery(false);
              } else if (
                event.key === "Enter" &&
                currentlyInContextQuery &&
                nestedContextProvider === undefined
              ) {
                selectContextItemFromDropdown(event);
              } else if (event.key === "Tab" && items.length > 0) {
                downshiftProps.setInputValue(items[0].name);
                event.preventDefault();
              } else if (event.key === "Tab") {
                (event.nativeEvent as any).preventDownshiftDefault = true;
              } else if (
                (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                items.length > 0
              ) {
                return;
              } else if (event.key === "ArrowUp") {
                // Only go back in history if selectionStart is 0
                // (i.e. the cursor is at the beginning of the input)
                if (
                  positionInHistory == 0 ||
                  event.currentTarget.selectionStart !== 0
                ) {
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                  return;
                } else if (
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
                if (
                  positionInHistory === history.length ||
                  event.currentTarget.selectionStart !==
                    event.currentTarget.value.length
                ) {
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                  return;
                }

                if (positionInHistory < history.length) {
                  downshiftProps.setInputValue(history[positionInHistory + 1]);
                }
                setPositionInHistory((prev) =>
                  Math.min(prev + 1, history.length)
                );
                setCurrentlyInContextQuery(false);
              } else if (event.key === "Escape") {
                if (nestedContextProvider) {
                  goBackToContextProviders();
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                  return;
                } else if (inQueryForContextProvider) {
                  goBackToContextProviders();
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                  return;
                }

                setCurrentlyInContextQuery(false);
                if (downshiftProps.isOpen && items.length > 0) {
                  downshiftProps.closeMenu();
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                } else {
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                  // Remove focus from the input
                  inputRef.current?.blur();
                  // Move cursor back over to the editor
                  postVscMessage("focusEditor", {});
                }
              }
              // Home and end keys
              else if (event.key === "Home") {
                (event.nativeEvent as any).preventDownshiftDefault = true;
              } else if (event.key === "End") {
                (event.nativeEvent as any).preventDownshiftDefault = true;
              }
            },
            onClick: () => {
              dispatch(setBottomMessage(undefined));
            },
            ref: inputRef,
          })}
        />
        {inQueryForContextProvider ? (
          <DynamicQueryTitleDiv>
            Enter {inQueryForContextProvider.display_title} Query
          </DynamicQueryTitleDiv>
        ) : (
          <>
            <StyledPlusIcon
              width="1.4em"
              height="1.4em"
              data-tooltip-id="add-context-button"
              onClick={() => {
                downshiftProps.setInputValue("@");
                inputRef.current?.focus();
              }}
            />
            <StyledTooltip id="add-context-button" place="bottom">
              Add Context to Prompt
            </StyledTooltip>
          </>
        )}

        <Ul
          {...downshiftProps.getMenuProps({
            ref: ulRef,
          })}
          showAbove={showAbove()}
          ulHeightPixels={ulRef.current?.getBoundingClientRect().height || 0}
          hidden={!downshiftProps.isOpen || items.length === 0}
        >
          {nestedContextProvider && (
            <div
              style={{
                backgroundColor: secondaryDark,
                borderBottom: `1px solid ${lightGray}`,
                display: "flex",
                gap: "4px",
                position: "sticky",
                top: "0px",
              }}
              className="py-2 px-4 my-0"
            >
              <ArrowLeftIcon
                width="1.4em"
                height="1.4em"
                className="cursor-pointer"
                onClick={() => {
                  goBackToContextProviders();
                }}
              />
              {nestedContextProvider.display_title} -{" "}
              {nestedContextProvider.description}
            </div>
          )}
          {downshiftProps.isOpen &&
            items.map((item, index) => (
              <Li
                style={{
                  borderTop: index === 0 ? "none" : undefined,
                }}
                key={`${item.name}${index}`}
                {...downshiftProps.getItemProps({ item, index })}
                highlighted={downshiftProps.highlightedIndex === index}
                selected={downshiftProps.selectedItem === item}
                onClick={(e) => {
                  // e.stopPropagation();
                  // e.preventDefault();
                  // (e.nativeEvent as any).preventDownshiftDefault = true;
                  // downshiftProps.selectItem(item);
                  selectContextItemFromDropdown(e);
                  onSelectedItemChangeCallback({ selectedItem: item });
                }}
              >
                <span>
                  {item.name}
                  {"  "}
                  <span
                    style={{
                      color: lightGray,
                    }}
                  >
                    {item.description}
                  </span>
                </span>
                {contextProviders
                  .filter(
                    (provider) => !provider.dynamic || provider.requires_query
                  )
                  .find((provider) => provider.title === item.id) && (
                  <ArrowRightIcon
                    width="1.2em"
                    height="1.2em"
                    color={lightGray}
                    className="ml-2"
                  />
                )}
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
