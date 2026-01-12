import {
  ArrowDownIcon,
  ArrowUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VirtuosoHandle } from "react-virtuoso";
import { HeaderButton, Input } from "..";
import { ChatHistoryItemWithMessageId } from "../../redux/slices/sessionSlice";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import { SearchMatch } from "./findWidgetSearch";
import { useDebounceValue } from "./useDebounce";
import { useElementSize } from "./useElementSize";

type ScrollToMatchOption = "closest" | "first" | "none";

/*
    useFindWidget takes a container ref and returns
    1. A widget that can be placed anywhere to search the contents of that container
    2. Search results and state
    3. Highlight components to be overlayed over the container

    Container must have relative positioning
*/
export const useFindWidget = (
  virtuosoRef: RefObject<VirtuosoHandle>,
  searchRef: RefObject<HTMLDivElement>,
  headerRef: RefObject<HTMLDivElement>,
  history: ChatHistoryItemWithMessageId[],
  disabled: boolean,
) => {
  // Search input, debounced
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentValue, setCurrentValue] = useState<string>("");
  const searchTerm = useDebounceValue(currentValue, 300);

  // Widget open/closed state
  const [open, setOpen] = useState<boolean>(false);
  const openWidget = useCallback(() => {
    setOpen(true);
    inputRef?.current?.select();
  }, [inputRef]);

  // Search settings and results
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [useRegex, setUseRegex] = useState<boolean>(false);

  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatch, setCurrentMatch] = useState<SearchMatch | undefined>(
    undefined,
  );

  // Navigating between search results
  // The "current" search result is highlighted a different color
  const scrollToMatch = useCallback(
    (match: SearchMatch) => {
      setCurrentMatch(match);
      if (match.messageIndex !== undefined && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index: match.messageIndex,
          align: "center",
        });
      }
    },
    [searchRef, virtuosoRef],
  );

  const nextMatch = useCallback(() => {
    if (!currentMatch || matches.length === 0) return;
    const newIndex = (currentMatch.index + 1) % matches.length;
    const newMatch = matches[newIndex];
    scrollToMatch(newMatch);
  }, [scrollToMatch, currentMatch, matches]);

  const previousMatch = useCallback(() => {
    if (!currentMatch || matches.length === 0) return;
    const newIndex =
      currentMatch.index === 0 ? matches.length - 1 : currentMatch.index - 1;
    const newMatch = matches[newIndex];
    scrollToMatch(newMatch);
  }, [scrollToMatch, currentMatch, matches]);

  // Handle keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "f" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        openWidget();
      } else if (document.activeElement === inputRef.current) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) previousMatch();
          else nextMatch();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [inputRef, matches, nextMatch]);

  // Handle container resize changes - highlight positions must adjust
  const { clientHeight: headerHeight, isResizing: headerResizing } =
    useElementSize(headerRef);
  const { isResizing: containerResizing } = useElementSize(searchRef);
  const isResizing = useMemo(() => {
    return containerResizing || headerResizing;
  }, [containerResizing, headerResizing]);

  // Track previous search term to determine if we should scroll
  const prevSearchTerm = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep a ref to the current match to avoid dependency loop in refreshSearch
  const currentMatchRef = useRef<SearchMatch | undefined>(undefined);
  useEffect(() => {
    currentMatchRef.current = currentMatch;
  }, [currentMatch]);

  // Main function for finding matches (Data Search)
  const refreshSearch = useCallback(async () => {
    // Search History
    const results: SearchMatch[] = [];
    const query = caseSensitive ? searchTerm : searchTerm.toLowerCase();

    // Abort previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (!query) {
      setMatches([]);
      return;
    }

    const CHUNK_SIZE = 100;
    let i = 0;

    const processChunk = async () => {
      const start = Date.now();
      while (i < history.length) {
        if (abortController.signal.aborted) return;

        // Yield to main thread every 10ms
        if (Date.now() - start > 10) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const item = history[i];
        i++;

        if (item.message.role === "system") continue;
        const content = item.message.content;
        const textContent =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content
                  .map((part) => (part.type === "text" ? part.text : ""))
                  .join("")
              : "";

        const textToCheck = caseSensitive
          ? textContent
          : textContent.toLowerCase();

        let startIndex = 0;
        let matchIndexInMessage = 0;
        while ((startIndex = textToCheck.indexOf(query, startIndex)) !== -1) {
          results.push({
            index: results.length,
            messageIndex: i - 1,
            messageId: item.message.id,
            matchIndexInMessage: matchIndexInMessage,
          });
          startIndex += query.length;
          matchIndexInMessage++;
        }
      }

      if (abortController.signal.aborted) return;
      setMatches(results);

      // Determine scrolling behavior
      if (searchTerm !== prevSearchTerm.current) {
        prevSearchTerm.current = searchTerm;
        if (results.length > 0) {
          scrollToMatch(results[0]);
        }
      } else {
        const activeMatch = currentMatchRef.current;
        if (activeMatch) {
          const matchingResult = results.find(
            (r) =>
              (activeMatch.messageId &&
                r.messageId === activeMatch.messageId &&
                r.matchIndexInMessage === activeMatch.matchIndexInMessage) ||
              (!activeMatch.messageId &&
                r.messageIndex === activeMatch.messageIndex),
          );
          if (matchingResult) {
            setCurrentMatch(matchingResult);
          } else {
            setCurrentMatch(results[0]);
          }
        } else if (results.length > 0) {
          setCurrentMatch(results[0]);
        }
      }
    };

    void processChunk();
  }, [searchTerm, caseSensitive, useRegex, history, scrollToMatch]);

  // Run search when dependencies change
  useEffect(() => {
    if (disabled || !open) {
      setMatches([]);
    } else {
      refreshSearch();
    }
  }, [refreshSearch, open, disabled]);

  // Find widget component
  const widget = (
    <div
      className={`fixed top-0 z-50 transition-all ${open ? "" : "-translate-y-full"} bg-vsc-background right-0 flex flex-row items-center gap-1.5 rounded-bl-lg border-0 border-b border-l border-solid border-zinc-700 pl-[3px] pr-3 sm:gap-2`}
    >
      <Input
        id="find-widget-input"
        name="find-widget-input"
        type="text"
        ref={inputRef}
        value={currentValue}
        onChange={(e) => {
          setCurrentValue(e.target.value);
        }}
        placeholder="Search..."
      />
      <p className="xs:block hidden min-w-12 whitespace-nowrap px-1 text-center text-xs">
        {matches.length === 0
          ? "No results"
          : `${(currentMatch?.index ?? 0) + 1} of ${matches.length}`}
      </p>
      <div className="hidden flex-row gap-0.5 sm:flex">
        <HeaderButtonWithToolTip
          tooltipPlacement="top-end"
          text={"Previous Match"}
          onClick={(e) => {
            e.stopPropagation();
            previousMatch();
          }}
          className="h-4 w-4 focus:ring"
          disabled={matches.length < 2 || disabled}
        >
          <ArrowUpIcon className="h-4 w-4" />
        </HeaderButtonWithToolTip>
        <HeaderButtonWithToolTip
          tooltipPlacement="top-end"
          text={"Next Match"}
          onClick={(e) => {
            e.stopPropagation();
            nextMatch();
          }}
          className="h-4 w-4 focus:ring"
          disabled={matches.length < 2 || disabled}
        >
          <ArrowDownIcon className="h-4 w-4" />
        </HeaderButtonWithToolTip>
      </div>
      <HeaderButtonWithToolTip
        disabled={disabled}
        inverted={caseSensitive}
        tooltipPlacement="top-end"
        text={
          caseSensitive
            ? "Turn off case sensitivity"
            : "Turn on case sensitivity"
        }
        onClick={(e) => {
          e.stopPropagation();
          setCaseSensitive((curr) => !curr);
        }}
        className="h-5 w-6 rounded-full border text-xs focus:outline-none focus:ring"
      >
        Aa
      </HeaderButtonWithToolTip>
      {/* TODO - add useRegex functionality */}
      <HeaderButton
        inverted={false}
        onClick={() => setOpen(false)}
        className="focus:ring"
      >
        <XMarkIcon className="h-4 w-4" />
      </HeaderButton>
    </div>
  );

  return {
    widget,
    searchState: {
      searchTerm: open ? searchTerm : "", // Only highlight if open
      caseSensitive,
      useRegex,
      currentMatch,
    },
  };
};
