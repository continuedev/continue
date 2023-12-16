import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpOnSquareIcon,
  BeakerIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeAltIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  PaintBrushIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { useCombobox } from "downshift";
import React, {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useState,
} from "react";
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
import { SearchContext } from "../../App";
import useContextProviders from "../../hooks/useContextProviders";
import useHistory from "../../hooks/useHistory";
import { contextLengthSelector } from "../../redux/selectors/modelSelectors";
import { setTakenActionTrue } from "../../redux/slices/miscSlice";
import {
  addContextItems,
  addContextItemsAtIndex,
  deleteContextWithIds,
  setInactive,
} from "../../redux/slices/stateSlice";
import { setBottomMessage } from "../../redux/slices/uiStateSlice";
import { RootStore } from "../../redux/store";
import {
  getFontSize,
  getMarkdownLanguageTagForFile,
  getMetaKeyLabel,
  getPlatform,
} from "../../util";
import { postToIde } from "../../util/ide";
import {
  handleKeyDownJetBrains,
  handleKeyDownJetBrainsMac,
} from "../../util/jetbrains";
import FileIcon from "../FileIcon";
import HeaderButtonWithText from "../HeaderButtonWithText";
import RingLoader from "../loaders/RingLoader";
import CodeSnippetPreview from "../markdown/CodeSnippetPreview";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";
import PillButton from "./PillButton";

const ICONS_FOR_DROPDOWN: { [key: string]: any } = {
  file: FolderIcon,
  terminal: CommandLineIcon,
  diff: PlusIcon,
  search: MagnifyingGlassIcon,
  url: GlobeAltIcon,
  open: FolderOpenIcon,
  "/edit": PaintBrushIcon,
  "/clear": TrashIcon,
  "/test": BeakerIcon,
  "/config": Cog6ToothIcon,
  "/comment": HashtagIcon,
  "/share": ArrowUpOnSquareIcon,
  "/cmd": CommandLineIcon,
  "/codebase": SparklesIcon,
  "/so": GlobeAltIcon,
  "/issue": ExclamationCircleIcon,
};

function DropdownIcon(props: { provider: string; className?: string }) {
  const Icon = ICONS_FOR_DROPDOWN[props.provider];
  if (!Icon) {
    return null;
  }
  return <Icon className={props.className} height="1.2em" width="1.2em" />;
}

// #region styled components

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

const HiddenHeaderButtonWithText = styled.button<{ pinVisible: boolean }>`
  opacity: ${({ pinVisible }) => (pinVisible ? 1 : 0)};
  background-color: transparent;
  border: none;
  outline: none;
  color: ${vscForeground};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 0;
  aspect-ratio: 1;
  padding: 0;
  margin-left: -8px;

  border-radius: ${defaultBorderRadius};

  &:focus {
    margin-left: 1px;
    height: fit-content;
    padding: 3px;
    opacity: 1;
    outline: 1px solid ${lightGray};
  }
`;

const mainInputFontSize = getFontSize();

const MainTextInput = styled.textarea<{
  inQueryForDynamicProvider: boolean;
  fontSize?: number;
}>`
  resize: none;

  padding: 8px;
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

const InputToolbar = styled.div`
  position: absolute;
  display: flex;
  gap: 4px;
  right: 12px;
  bottom: 4px;
  width: calc(100% - 28px);
  background-color: ${secondaryDark};

  align-items: center;
  z-index: 50;
  font-size: 10px;

  cursor: text;

  & > * {
    flex: 0 0 auto;
  }
`;

const EnterButton = styled.div<{ offFocus: boolean }>`
  padding: 2px 4px;
  display: flex;
  align-items: center;

  background-color: ${(props) =>
    props.offFocus ? undefined : lightGray + "33"};
  border-radius: ${defaultBorderRadius};
  color: #fff8;

  &:hover {
    background-color: #cf313199;
    color: white;
  }

  cursor: pointer;
`;

const NewSessionButton = styled.div`
  width: fit-content;
  margin-right: auto;
  margin-left: 8px;
  margin-top: 4px;

  font-size: 12px;

  border-radius: ${defaultBorderRadius};
  padding: 2px 8px;
  color: ${lightGray};

  &:hover {
    background-color: ${lightGray}33;
    color: ${vscForeground};
  }

  cursor: pointer;
`;

const DeleteButtonDiv = styled.div`
  position: absolute;
  top: 14px;
  right: 12px;
  background-color: ${secondaryDark};
  border-radius: ${defaultBorderRadius};
  z-index: 50;
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

const UlMaxHeight = 300;
const Ul = styled.ul<{
  hidden: boolean;
  showAbove: boolean;
  ulHeightPixels: number;
  inputBoxHeight?: string;
  fontSize?: number;
  isMainInput: boolean;
}>`
  ${(props) =>
    props.showAbove
      ? `transform: translateY(-${props.ulHeightPixels + 8}px);`
      : `transform: translateY(${
          (props.isMainInput ? 5 : 4) * (props.fontSize || mainInputFontSize) -
          (props.isMainInput ? 2 : 4) -
          6
        }px);`}
  position: absolute;
  /* background: ${vscBackground}; */
  background-color: transparent;
  backdrop-filter: blur(12px);

  color: ${vscForeground};
  max-height: ${UlMaxHeight}px;
  margin-left: 1px;
  width: calc(100% - 18px);
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 0;
  ${({ hidden }) => hidden && "display: none;"}
  border-radius: ${defaultBorderRadius};
  outline: 0.5px solid ${lightGray};
  -ms-overflow-style: none;
  font-size: ${(props) => props.fontSize || mainInputFontSize}px;

  scrollbar-width: none; /* Firefox */
  z-index: 500;

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
    highlighted ? buttonColor + "66" : "transparent"};
  ${({ selected }) => selected && "font-weight: bold;"}
  padding: 0.35rem 0.5rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  ${({ isLastItem }) => isLastItem && "border-bottom: 1px solid gray;"}
  cursor: pointer;
  z-index: 500;
`;

// #endregion

interface ComboBoxItem {
  title: string;
  description: string;
  id?: string;
  content?: string;
}
interface ComboBoxProps {
  onInputValueChange?: (inputValue: string) => void;
  disabled?: boolean;
  onEnter?: (e?: React.KeyboardEvent<HTMLInputElement>, value?: string) => void;
  onToggleAddContext?: () => void;

  isMainInput: boolean;
  isLastUserInput: boolean;
  value?: string;
  isToggleOpen?: boolean;
  index?: number;
  onDelete?: () => void;
}

const ComboBox = React.forwardRef((props: ComboBoxProps, ref) => {
  const [miniSearch, firstResults] = useContext(SearchContext);

  const dispatch = useDispatch();
  const state = useSelector((state: RootStore) => state.state);

  const [history, setHistory] = React.useState<string[]>([]);
  // The position of the current command you are typing now, so the one that will be appended to history once you press enter
  const [positionInHistory, setPositionInHistory] = React.useState<number>(0);
  const [items, setItems] = React.useState<ComboBoxItem[]>([]);

  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height =
      Math.min(inputRef.current.scrollHeight, 300) + "px";
  }, [
    inputRef.current?.scrollHeight,
    inputRef.current?.clientHeight,
    inputRef.current?.value,
  ]);

  // Whether the current input follows an '@' and should be treated as context query
  const [currentlyInContextQuery, setCurrentlyInContextQuery] = useState(false);
  const [nestedContextProvider, setNestedContextProvider] = useState<
    any | undefined
  >(undefined);
  const [inQueryForContextProvider, setInQueryForContextProvider] = useState<
    any | undefined
  >(undefined);

  const availableSlashCommands = useSelector(
    (state: RootStore) =>
      state.state.config.slashCommands?.map((cmd) => {
        return {
          title: `/${cmd.name}`,
          description: cmd.description,
        };
      }) || []
  );
  const selectedContextItems = useSelector((state: RootStore) => {
    if (typeof props.index !== "undefined") {
      return state.state.history[props.index].contextItems;
    } else {
      return state.state.contextItems;
    }
  });

  const active = useSelector((state: RootStore) => state.state.active);

  useEffect(() => {
    if (!currentlyInContextQuery) {
      setNestedContextProvider(undefined);
      setInQueryForContextProvider(undefined);
    }
  }, [currentlyInContextQuery]);

  const contextProviders = useSelector(
    (store: RootStore) => store.state.config.contextProviders
  );

  const goBackToContextProviders = () => {
    setCurrentlyInContextQuery(false);
    setNestedContextProvider(undefined);
    setInQueryForContextProvider(undefined);
    downshiftProps.setInputValue("@");
  };

  useEffect(() => {
    if (!nestedContextProvider) {
      setItems(
        contextProviders
          ?.map((provider) => ({
            title: provider.description.displayTitle,
            description: provider.description.description,
            id: provider.description.title,
          }))
          .sort((c, _) => (c.id === "file" ? -1 : 1)) || []
      );
    }
  }, [nestedContextProvider]);

  const [prevInputValue, setPrevInputValue] = useState("");

  const { getContextItems } = useContextProviders();

  const selectContextItem = useCallback(
    async (id: string, query: string) => {
      const timeout = setTimeout(() => {
        setWaitingForContextItem(true);
      }, 0.1);
      const contextItems = await getContextItems(id, query);
      clearTimeout(timeout);
      setWaitingForContextItem(false);
      if (props.isMainInput) {
        dispatch(addContextItems(contextItems));
      } else if (typeof props.index !== "undefined") {
        dispatch(addContextItemsAtIndex({ contextItems, index: props.index }));
      }
    },
    [props.index, getContextItems]
  );

  const onInputValueChangeCallback = useCallback(
    ({ inputValue, highlightedIndex }: any) => {
      // Clear the input
      if (!inputValue) {
        setItems([]);
        setNestedContextProvider(undefined);
        setCurrentlyInContextQuery(false);
        return;
      }

      // Hacky way of stopping bug where first context provider title is injected into input
      if (
        prevInputValue === "" &&
        contextProviders?.some((p) => p.description.displayTitle === inputValue)
      ) {
        downshiftProps.setInputValue("");
        setPrevInputValue("");
        return;
      }
      setPrevInputValue(inputValue);

      if (
        inQueryForContextProvider &&
        !inputValue.startsWith(`@${inQueryForContextProvider.title}`)
      ) {
        setInQueryForContextProvider(undefined);
      }

      props.onInputValueChange?.(inputValue);

      // Handle context selection
      if (inputValue.endsWith("@") || currentlyInContextQuery) {
        const segs = inputValue?.split("@") || [];

        if (segs.length > 1) {
          // Get search results and return
          setCurrentlyInContextQuery(true);
          const providerAndQuery = segs[segs.length - 1] || "";

          if (nestedContextProvider && !inputValue.endsWith("@")) {
            // Search only within this specific context provider
            const spaceSegs = providerAndQuery.split(" ");
            getFilteredContextItemsForProvider(
              nestedContextProvider.title,
              spaceSegs.length > 1 ? spaceSegs[1] : ""
            ).then((res) => {
              setItems(res);
            });
          } else {
            // Search through the list of context providers
            const filteredItems =
              contextProviders
                ?.filter(
                  (provider) =>
                    `@${provider.description.title}`
                      .toLowerCase()
                      .startsWith(inputValue.toLowerCase()) ||
                    `@${provider.description.displayTitle}`
                      .toLowerCase()
                      .startsWith(inputValue.toLowerCase())
                )
                .map((provider) => ({
                  name: provider.description.displayTitle,
                  description: provider.description.description,
                  id: provider.description.title,
                  title: provider.description.displayTitle,
                }))
                .sort((c, _) => (c.id === "file" ? -1 : 1)) || [];
            setItems(filteredItems.map((item) => item));
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
        availableSlashCommands?.filter((slashCommand) => {
          const sc = slashCommand.title.toLowerCase();
          const iv = inputValue.toLowerCase();
          return sc.startsWith(iv) && sc !== iv;
        }) || []
      );

      if (inputValue.startsWith("/") || inputValue.startsWith("@")) {
        dispatch(setTakenActionTrue(null));
      }
    },
    [
      availableSlashCommands,
      currentlyInContextQuery,
      nestedContextProvider,
      inQueryForContextProvider,
    ]
  );

  const getFilteredContextItemsForProvider = async (
    provider: string,
    query: string
  ) => {
    try {
      let res: any = miniSearch.search(query.trim() === "" ? "/" : query, {
        prefix: true,
        fuzzy: 1,
      });
      if (res.length === 0) {
        res = firstResults;
      }
      return (
        res?.map((hit) => {
          const item: ComboBoxItem = {
            title: hit.basename,
            description: hit.basename,
            id: hit.id,
            content: hit.id,
          };
          return item;
        }) || []
      );
    } catch (e) {
      console.log("Error searching context items", e);
      return [];
    }
  };

  const { getInputProps, ...downshiftProps } = useCombobox({
    onInputValueChange: onInputValueChangeCallback,
    items,
    itemToString(item) {
      return item ? item.title : "";
    },
    initialInputValue: props.value || undefined,
  });

  const [waitingForContextItem, setWaitingForContextItem] = useState(false);

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
  const handleTabPressed = useCallback(() => {
    setShowContextItemsIfNotMain(true);
    // Set the focus to the next item in the context items div
    if (!contextItemsDivRef.current) {
      return;
    }
    const focusableItems = contextItemsDivRef.current.querySelectorAll(
      `.pill-button-${props.index || "main"}`
    );
    const focusableItemsArray = Array.from(focusableItems);
    const focusedItemIndex = focusableItemsArray.findIndex(
      (item) => item === document.activeElement
    );
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
  }, [props.index]);

  useEffect(() => {
    if (inputRef.current) {
      const listener = (e: any) => {
        if (e.key === "Tab") {
          e.preventDefault();
          handleTabPressed();
        }
      };
      inputRef.current.addEventListener("keydown", listener);
      return () => {
        inputRef.current?.removeEventListener("keydown", listener);
      };
    }
  }, [inputRef.current]);

  useEffect(() => {
    if (props.value) {
      downshiftProps.setInputValue(props.value);
    }
  }, [props.value, downshiftProps.setInputValue]);

  const [isHovered, setIsHovered] = useState(false);

  useLayoutEffect(() => {
    if (!ulRef.current) {
      return;
    }
    downshiftProps.setHighlightedIndex(0);
  }, [items, downshiftProps.setHighlightedIndex, ulRef.current]);

  const [metaKeyPressed, setMetaKeyPressed] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
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
  }, []);

  const { saveSession } = useHistory(dispatch);

  useEffect(() => {
    if (!inputRef.current || !props.isMainInput) {
      return;
    }
    if (props.isMainInput) {
      inputRef.current.focus();
    }
    const handler = (event: any) => {
      if (event.data.type === "focusContinueInput") {
        inputRef.current!.focus();
        if (state.history.length > 0) {
          saveSession();
        }
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithEdit") {
        inputRef.current!.focus();
        if (state.history.length > 0) {
          saveSession();
        }

        if (!inputRef.current?.value.startsWith("/edit")) {
          downshiftProps.setInputValue("/edit ");
        }
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithNewSession") {
        saveSession();
        dispatch(setTakenActionTrue(null));
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [inputRef.current, props.isMainInput, state.history.length]);

  const deleteButtonDivRef = React.useRef<HTMLDivElement>(null);
  const stickyDropdownHeaderDiv = React.useRef<HTMLDivElement>(null);

  const selectContextItemFromDropdown = useCallback(
    (event: any) => {
      const newItem = items[downshiftProps.highlightedIndex];
      const newProviderName = newItem?.title;
      const newProvider = contextProviders.find(
        (provider) => provider.description.displayTitle === newProviderName
      );

      if (!newProvider) {
        if (nestedContextProvider && newItem.id) {
          // Tell server the context item was selected
          selectContextItem("file", newItem.id);

          // Clear the input
          downshiftProps.setInputValue("");
          setCurrentlyInContextQuery(false);
          setNestedContextProvider(undefined);
          setInQueryForContextProvider(undefined);
          (event.nativeEvent as any).preventDownshiftDefault = true;
          event.preventDefault();
          return;
        }
        // This is a slash command
        (event.nativeEvent as any).preventDownshiftDefault = true;
        event.preventDefault();
        return;
      } else if (
        newProvider.description.dynamic &&
        newProvider.description.requiresQuery
      ) {
        // This is a dynamic context provider that requires a query, like URL / Search
        setInQueryForContextProvider(newProvider);
        downshiftProps.setInputValue(`@${newProvider.description.title} `);
        (event.nativeEvent as any).preventDownshiftDefault = true;
        event.preventDefault();
        return;
      } else if (newProvider.description.dynamic) {
        // This is a normal dynamic context provider like Diff or Terminal
        if (!newItem.id) return;

        // Get the query from the input value
        const segs = downshiftProps.inputValue.split("@");
        const query = segs[segs.length - 1];

        // Tell server the context item was selected
        selectContextItem(newItem.id, query);
        if (downshiftProps.inputValue.includes("@")) {
          const selectedNestedContextProvider = contextProviders.find(
            (provider) => provider.description.title === newItem.id
          );
          if (
            !nestedContextProvider &&
            !selectedNestedContextProvider?.description.dynamic
          ) {
            downshiftProps.setInputValue(`@${newItem.id} `);
            setNestedContextProvider(selectedNestedContextProvider.description);
          } else {
            downshiftProps.setInputValue("");
          }
        }

        // Clear the input
        downshiftProps.setInputValue("");
        setCurrentlyInContextQuery(false);
        setNestedContextProvider(undefined);
        setInQueryForContextProvider(undefined);
        (event.nativeEvent as any).preventDownshiftDefault = true;
        event.preventDefault();
        return;
      }

      setNestedContextProvider(newProvider.description);
      downshiftProps.setInputValue(`@${newProvider.description.title} `);
      (event.nativeEvent as any).preventDownshiftDefault = true;
      event.preventDefault();
      getFilteredContextItemsForProvider(
        newProvider.description.title,
        ""
      ).then((items) => setItems(items));
    },
    [
      items,
      downshiftProps.highlightedIndex,
      contextProviders,
      nestedContextProvider,
      downshiftProps.inputValue,
      selectContextItem,
    ]
  );

  const [contextLengthFillPercentage, setContextLengthFillPercentage] =
    useState<number>(0);

  const contextLength = useSelector(contextLengthSelector);

  useEffect(() => {
    let tokenEstimate = selectedContextItems.reduce((acc, item) => {
      return acc + item.content.length / Math.E; // Just an estimate of tokens / char
    }, 0);
    tokenEstimate += downshiftProps.inputValue.length / Math.E;
    setContextLengthFillPercentage(
      tokenEstimate / Math.max(1, contextLength - 600)
    );
  }, [selectedContextItems.length, contextLength]);

  const [isComposing, setIsComposing] = useState(false);

  const [showContextToggleOn, setShowContextToggleOn] = useState(false);

  const [previewingContextItem, setPreviewingContextItem] = useState<
    ContextItemWithId | undefined
  >(undefined);

  const [focusedContextItem, setFocusedContextItem] = useState<
    ContextItemWithId | undefined
  >(undefined);

  const topRef = React.useRef<HTMLDivElement>(null);

  const [showContextItemsIfNotMain, setShowContextItemsIfNotMain] =
    useState(false);

  useEffect(() => {
    if (!inputFocused) {
      setShowContextItemsIfNotMain(false);
    }
  }, [inputFocused]);

  useEffect(() => {
    if (selectedContextItems.length > 0) {
      setShowContextItemsIfNotMain(true);
    }
  }, [selectedContextItems]);

  return (
    <div
      ref={topRef}
      style={{
        paddingTop: "4px",
        backgroundColor: vscBackground,
      }}
    >
      {selectedContextItems.length === 0 && props.isMainInput && (
        <div
          style={{
            color: lightGray,
            fontSize: "10px",
            backgroundColor: vscBackground,
            paddingLeft: "12px",
            paddingTop: getFontSize(),
            width: "calc(100% - 24px)",
          }}
        >
          {downshiftProps.inputValue?.startsWith("/edit") && (
            <>
              <span className="float-right">Inserting at cursor</span>
              <br />
            </>
          )}
        </div>
      )}

      {props.isMainInput ||
      (selectedContextItems.length > 0 && showContextItemsIfNotMain) ? (
        <div
          className="px-2 flex gap-2 items-center flex-wrap"
          ref={contextItemsDivRef}
          style={{ backgroundColor: vscBackground }}
        >
          {selectedContextItems.length > 0 && (
            <div
              className="cursor-pointer"
              onClick={(e) => {
                setShowContextToggleOn((prev) => !prev);
              }}
              tabIndex={0}
              id="toggle-context-div"
            >
              {showContextToggleOn ? (
                <ChevronDownIcon width="14px" height="14px" color={lightGray} />
              ) : (
                <ChevronRightIcon
                  width="14px"
                  height="14px"
                  color={lightGray}
                />
              )}
            </div>
          )}

          <HiddenHeaderButtonWithText
            pinVisible={selectedContextItems.length >= 8}
            className={
              selectedContextItems.length > 0
                ? `pill-button-${props.index || "main"}`
                : ""
            }
            onClick={() => {
              dispatch(
                deleteContextWithIds({
                  ids: selectedContextItems.map((item) => item.id),
                  index: props.index,
                })
              );
              inputRef.current?.focus();
              setPreviewingContextItem(undefined);
              setFocusedContextItem(undefined);
            }}
            onKeyDown={(e: any) => {
              if (e.key === "Backspace") {
                dispatch(
                  deleteContextWithIds({
                    ids: selectedContextItems.map((item) => item.id),
                    index: props.index,
                  })
                );
                inputRef.current?.focus();
                setPreviewingContextItem(undefined);
                setFocusedContextItem(undefined);
              }
            }}
          >
            <TrashIcon width="1.2em" height="1.2em" />
          </HiddenHeaderButtonWithText>
          {selectedContextItems.length < 8 ? (
            <>
              {selectedContextItems.map((item, idx) => {
                return (
                  <PillButton
                    inputIndex={props.index}
                    areMultipleItems={selectedContextItems.length > 1}
                    key={`${item.id.itemId}${idx}`}
                    item={item}
                    editing={
                      item.editing &&
                      (inputRef.current as any)?.value?.startsWith("/edit")
                    }
                    editingAny={(inputRef.current as any)?.value?.startsWith(
                      "/edit"
                    )}
                    stepIndex={props.index}
                    index={idx}
                    onDelete={() => {
                      dispatch(
                        deleteContextWithIds({
                          ids: [item.id],
                          index: props.index,
                        })
                      );
                      inputRef.current?.focus();
                      if (
                        (item.id.itemId === focusedContextItem?.id.itemId &&
                          focusedContextItem?.id.providerTitle ===
                            item.id.providerTitle) ||
                        (item.id.itemId === previewingContextItem?.id.itemId &&
                          previewingContextItem?.id.providerTitle ===
                            item.id.providerTitle)
                      ) {
                        setPreviewingContextItem(undefined);
                        setFocusedContextItem(undefined);
                      }
                    }}
                    onClick={(e) => {
                      if (
                        item.id.itemId === focusedContextItem?.id.itemId &&
                        focusedContextItem?.id.providerTitle ===
                          item.id.providerTitle
                      ) {
                        setFocusedContextItem(undefined);
                      } else {
                        setFocusedContextItem(item);
                      }
                    }}
                    onBlur={() => {
                      setFocusedContextItem(undefined);
                    }}
                    toggleViewContent={() => {
                      setPreviewingContextItem((prev) => {
                        if (!prev) return item;
                        if (
                          prev.id.itemId === item.id.itemId &&
                          prev.id.providerTitle === item.id.providerTitle
                        ) {
                          return undefined;
                        } else {
                          return item;
                        }
                      });
                    }}
                    previewing={
                      item.id.itemId === previewingContextItem?.id.itemId &&
                      previewingContextItem?.id.providerTitle ===
                        item.id.providerTitle
                    }
                    focusing={
                      item.id.itemId === focusedContextItem?.id.itemId &&
                      focusedContextItem?.id.providerTitle ===
                        item.id.providerTitle
                    }
                    prefixInputWithEdit={(should) => {
                      if (
                        !should &&
                        inputRef.current?.value.startsWith("/edit")
                      ) {
                        downshiftProps.setInputValue(
                          inputRef.current?.value.replace("/edit ", "")
                        );
                      }
                      if (downshiftProps.inputValue.startsWith("/edit")) return;
                      downshiftProps.setInputValue(
                        `/edit ${downshiftProps.inputValue}`
                      );
                      inputRef.current?.focus();
                    }}
                  />
                );
              })}
              {waitingForContextItem && (
                <RingLoader
                  period={1.5}
                  className="ml-0 mt-1 mb-0"
                  width="1.0em"
                  height="1.0em"
                  size={32}
                  wFull={false}
                ></RingLoader>
              )}
              {contextLengthFillPercentage > 1 && (
                <HeaderButtonWithText
                  text={`Context selected may exceed token limit (~${(
                    100 * contextLengthFillPercentage
                  ).toFixed(0)}%)`}
                >
                  <ExclamationTriangleIcon
                    width="1.0em"
                    height="1.0em"
                    color="red"
                  />
                </HeaderButtonWithText>
              )}
            </>
          ) : (
            <div
              onClick={() => {
                if (props.isMainInput) {
                  setShowContextToggleOn((prev) => !prev);
                } else {
                  inputRef.current?.focus();
                  setShowContextItemsIfNotMain(true);
                }
              }}
              id="snippets-selected-div"
              style={{
                color: lightGray,
                backgroundColor: vscBackground,
                fontSize: "12px",
                alignItems: "center",
                display: "flex",
                height: "100%",
                cursor: "pointer",
              }}
            >
              {selectedContextItems.length} snippets selected
            </div>
          )}
        </div>
      ) : (
        selectedContextItems.length > 0 && (
          <div
            onClick={() => {
              inputRef.current?.focus();
              setShowContextItemsIfNotMain(true);
            }}
            style={{
              color: lightGray,
              fontSize: "10px",
              backgroundColor: vscBackground,
              paddingLeft: "12px",
              cursor: "default",
              paddingTop: getFontSize(),
              width: "fit-content",
            }}
          >
            {active ? "Using" : "Used"} {selectedContextItems.length} context
            item
            {selectedContextItems.length === 1 ? "" : "s"}
          </div>
        )
      )}
      {previewingContextItem && (
        <pre className="m-0">
          <StyledMarkdownPreview
            source={`\`\`\`${getMarkdownLanguageTagForFile(
              previewingContextItem.description
            )}\n${previewingContextItem.content}\n\`\`\``}
            maxHeight={200}
          />
        </pre>
      )}
      {showContextToggleOn && selectedContextItems.length > 0 && (
        <div>
          <HeaderButtonWithText
            className="mr-4 ml-auto -mt-2"
            text="Delete All"
            onClick={() => {
              dispatch(
                deleteContextWithIds({
                  ids: selectedContextItems.map((item) => item.id),
                  index: props.index,
                })
              );
              inputRef.current?.focus();
              setPreviewingContextItem(undefined);
              setFocusedContextItem(undefined);
            }}
          >
            <div className="flex items-center">
              <TrashIcon width="1.2em" height="1.2em" />
              Delete All
            </div>
          </HeaderButtonWithText>
          {selectedContextItems.map((item) => (
            <CodeSnippetPreview
              index={props.index}
              item={item}
            ></CodeSnippetPreview>
          ))}
        </div>
      )}
      <div
        className="flex px-2 relative"
        style={{
          backgroundColor: vscBackground,
        }}
        ref={divRef}
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
          <MainTextInput
            onClick={() => {
              inputRef.current?.focus();
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={(e) => {
              if (
                e.relatedTarget === deleteButtonDivRef.current ||
                (e.relatedTarget instanceof Node &&
                  deleteButtonDivRef.current?.contains(e.relatedTarget as Node))
              ) {
                return;
              }
              setIsHovered(false);
            }}
            rows={props.isMainInput ? undefined : 1}
            inQueryForDynamicProvider={
              typeof inQueryForContextProvider !== "undefined"
            }
            fontSize={getFontSize()}
            disabled={props.disabled}
            placeholder={
              state.history.length === 0
                ? `Ask a question, '/' for slash commands, '@' to add context`
                : `Ask a follow-up`
            }
            {...getInputProps({
              onCompositionStart: () => setIsComposing(true),
              onCompositionEnd: () => setIsComposing(false),
              onChange: (e) => {},
              onFocus: (e) => {
                setInputFocused(true);
                dispatch(setBottomMessage(undefined));
              },
              onBlur: (e) => {
                if (
                  topRef.current?.contains(e.relatedTarget as Node) ||
                  document
                    .getElementById("toggle-context-div")
                    ?.contains(e.relatedTarget as Node) ||
                  document
                    .getElementById("snippets-selected-div")
                    ?.contains(e.relatedTarget as Node)
                ) {
                  return;
                }
                setInputFocused(false);
              },
              onKeyDown: (event) => {
                // Prevent duplicate calls to keyDown events due to IME.
                if (isComposing) {
                  return;
                }
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
                    selectContextItem(
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
                      props.onEnter(event, value);
                    }
                  }
                  setCurrentlyInContextQuery(false);
                } else if (event.key === "Enter" && currentlyInContextQuery) {
                  // Handle "Enter" for Context Providers
                  selectContextItemFromDropdown(event);
                } else if (
                  event.key === "Tab" &&
                  downshiftProps.isOpen &&
                  items.length > 0 &&
                  items[downshiftProps.highlightedIndex]?.title.startsWith("/")
                ) {
                  downshiftProps.setInputValue(items[0].title);
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
                    downshiftProps.setInputValue(
                      history[positionInHistory + 1]
                    );
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
                    postToIde("focusEditor", {});
                  }
                }
                // Home and end keys
                else if (event.key === "Home") {
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                } else if (event.key === "End") {
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                } else if (localStorage.getItem("ide") === "jetbrains") {
                  if (getPlatform() === "mac") {
                    handleKeyDownJetBrainsMac(
                      event,
                      downshiftProps.inputValue,
                      downshiftProps.setInputValue
                    );
                  } else {
                    handleKeyDownJetBrains(
                      event,
                      downshiftProps.inputValue,
                      downshiftProps.setInputValue
                    );
                  }
                }
              },
              onClick: () => {
                dispatch(setBottomMessage(undefined));
              },
              ref: inputRef,
            })}
          />

          {(inputFocused || props.isMainInput) && (
            <InputToolbar>
              <span
                style={{
                  color: lightGray,
                }}
                onClick={() => {
                  downshiftProps.setInputValue("@");
                  inputRef.current?.focus();
                }}
                className="hover:underline cursor-pointer mr-auto"
              >
                + Add Context
              </span>
              <span
                style={{
                  color: downshiftProps.inputValue?.startsWith("/codebase")
                    ? "#fff8"
                    : lightGray,
                  backgroundColor: downshiftProps.inputValue?.startsWith(
                    "/codebase"
                  )
                    ? lightGray + "33"
                    : undefined,
                  borderRadius: defaultBorderRadius,
                  padding: "2px 4px",
                }}
                onClick={() => {
                  const inputValue = downshiftProps.inputValue;
                  if (inputValue?.startsWith("/codebase")) {
                    downshiftProps.setInputValue(
                      inputValue.replace("/codebase ", "")
                    );
                  } else {
                    downshiftProps.setInputValue("/codebase " + inputValue);
                  }
                  inputRef.current?.focus();
                }}
                className={"hover:underline cursor-pointer float-right"}
              >
                {/* {downshiftProps.inputValue?.startsWith("/codebase")
                  ? "Using Codebase"
                  : `${getMetaKeyLabel()} ⏎ Use Codebase`} */}
              </span>

              <EnterButton
                offFocus={downshiftProps.inputValue?.startsWith("/codebase")}
                // disabled={
                //   !active &&
                //   (!(inputRef.current as any)?.value ||
                //     typeof client === "undefined")
                // }
                onClick={() => {
                  if (active) {
                    dispatch(setInactive());
                  } else {
                    props.onEnter?.(undefined);
                  }
                }}
              >
                ⏎ Enter
              </EnterButton>
            </InputToolbar>
          )}
          {props.isMainInput || (
            <DeleteButtonDiv ref={deleteButtonDivRef}>
              {isHovered && (
                <div className="flex">
                  <>
                    {/* {timeline
                      .filter(
                        (h, i: number) =>
                          props.groupIndices?.includes(i) && h.logs
                      )
                      .some((h) => h.logs!.length > 0) && (
                      <HeaderButtonWithText
                        onClick={(e) => {
                          e.stopPropagation();
                          if (props.groupIndices) {
                            const content =
                              "This is the exact prompt sent to the LLM: \n\n" +
                              timeline
                                .filter((_, i) => {
                                  return props.groupIndices?.includes(i);
                                })
                                .flatMap((s) => s.logs || [])
                                .join("\n");
                            postToIde("showVirtualFile", {
                              name: "inspect_prompt.md",
                              content,
                            });
                          }
                        }}
                        text="Inspect Prompt"
                      >
                        <ArrowUpLeftIcon width="1.3em" height="1.3em" />
                      </HeaderButtonWithText>
                    )} */}
                    {/* <HeaderButtonWithText
                      onClick={(e) => {
                        e.stopPropagation();
                        if (props.active && props.groupIndices) {
                          client?.stopSession();
                        } else {
                          props.onDelete?.();
                        }
                      }}
                      text={
                        props.active ? `Stop (${getMetaKeyLabel()}⌫)` : "Delete"
                      }
                    >
                      {props.active ? null : (
                        // <StopCircleIcon width="1.4em" height="1.4em" />
                        <XMarkIcon width="1.4em" height="1.4em" />
                      )}
                    </HeaderButtonWithText> */}
                  </>
                </div>
              )}
            </DeleteButtonDiv>
          )}
        </GradientBorder>
        {inQueryForContextProvider && (
          <DynamicQueryTitleDiv>
            Enter {inQueryForContextProvider.display_title} Query
          </DynamicQueryTitleDiv>
        )}

        <Ul
          {...downshiftProps.getMenuProps({
            ref: ulRef,
          })}
          isMainInput={props.isMainInput}
          showAbove={showAbove()}
          ulHeightPixels={ulRef.current?.getBoundingClientRect().height || 0}
          hidden={
            !downshiftProps.isOpen ||
            items.length === 0 ||
            inputRef.current?.value === ""
          }
          fontSize={getFontSize()}
        >
          {nestedContextProvider && (
            <div
              ref={stickyDropdownHeaderDiv}
              style={{
                backgroundColor: secondaryDark,
                borderBottom: `0.5px solid ${lightGray}`,
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
                onClick={(e) => {
                  goBackToContextProviders();
                  inputRef.current?.focus();
                }}
              />
              {nestedContextProvider.displayTitle} -{" "}
              {nestedContextProvider.description}
            </div>
          )}
          <div
            style={{
              maxHeight: `${
                UlMaxHeight -
                (stickyDropdownHeaderDiv.current?.clientHeight || 50)
              }px`,
              overflow: "auto",
            }}
          >
            {downshiftProps.isOpen &&
              items.map((item, index) => (
                <Li
                  style={{
                    borderTop:
                      index === 0 ? "none" : `0.5px solid ${lightGray}`,
                  }}
                  key={`${item.title}${index}`}
                  {...downshiftProps.getItemProps({ item, index })}
                  highlighted={downshiftProps.highlightedIndex === index}
                  selected={downshiftProps.selectedItem === item}
                  onClick={(e) => {
                    selectContextItemFromDropdown(e);
                    e.stopPropagation();
                    e.preventDefault();
                    inputRef.current?.focus();
                  }}
                >
                  <span className="flex justify-between w-full items-center">
                    <div className="flex items-center justify-center">
                      {nestedContextProvider && (
                        <FileIcon
                          height="20px"
                          width="20px"
                          filename={item.title}
                        ></FileIcon>
                      )}
                      <DropdownIcon provider={item.title} className="mr-2" />
                      <DropdownIcon provider={item.id} className="mr-2" />
                      {item.title}
                      {"  "}
                    </div>
                    <span
                      style={{
                        color: vscForeground,
                        float: "right",
                        textAlign: "right",
                      }}
                      hidden={downshiftProps.highlightedIndex !== index}
                      className="whitespace-nowrap overflow-hidden overflow-ellipsis ml-2"
                    >
                      {item.description}
                    </span>
                  </span>
                  {contextProviders
                    ?.filter(
                      (provider) =>
                        !provider.description.dynamic ||
                        provider.description.requiresQuery
                    )
                    .find(
                      (provider) => provider.description.title === item.id
                    ) && (
                    <ArrowRightIcon
                      width="1.2em"
                      height="1.2em"
                      color={vscForeground}
                      className="ml-2 flex-shrink-0"
                    />
                  )}
                </Li>
              ))}
            {downshiftProps.isOpen && items.length === 0 && (
              <Li
                key="empty-items-li"
                highlighted={false}
                selected={false}
                isLastItem={false}
              >
                <span
                  style={{
                    color: lightGray,
                    float: "right",
                    textAlign: "right",
                    display: "flex",
                    width: "100%",
                    cursor: "default",
                  }}
                >
                  No items found
                </span>
              </Li>
            )}
          </div>
        </Ul>
      </div>
      {props.isMainInput &&
        (active ? (
          <>
            <br />
            <br />
          </>
        ) : state.history.length > 0 ? (
          <NewSessionButton
            onClick={() => {
              saveSession();
            }}
            className="mr-auto"
          >
            New Session ({getMetaKeyLabel()} M)
          </NewSessionButton>
        ) : null)}
    </div>
  );
});

export default ComboBox;
