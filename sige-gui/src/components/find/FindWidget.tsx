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
import { HeaderButton, Input } from "..";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import {
  Rectangle,
  SearchMatch,
  searchWithinContainer,
} from "./findWidgetSearch";
import { useDebounceValue } from "./useDebounce";
import { useElementSize } from "./useElementSize";

interface HighlightOverlayProps {
  rectangle: Rectangle;
  isCurrent: boolean;
}

const HighlightOverlay = (props: HighlightOverlayProps) => {
  const { top, left, width, height } = props.rectangle;
  return (
    <div
      className={props.isCurrent ? "bg-findMatch-selected" : "bg-findMatch"}
      key={`highlight-${top}-${left}`}
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        pointerEvents: "none", // To click through the overlay
        zIndex: 10,
      }}
    />
  );
};

type ScrollToMatchOption = "closest" | "first" | "none";

/*
    useFindWidget takes a container ref and returns
    1. A widget that can be placed anywhere to search the contents of that container
    2. Search results and state
    3. Highlight components to be overlayed over the container

    Container must have relative positioning
*/
export const useFindWidget = (
  searchRef: RefObject<HTMLDivElement>,
  headerRef: RefObject<HTMLDivElement>,
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
      searchRef?.current?.scrollTo({
        top: match.overlayRectangle.top - searchRef.current.clientHeight / 2,
        left: match.overlayRectangle.left - searchRef.current.clientWidth / 2,
        behavior: "smooth",
      });
    },
    [searchRef],
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
      if (event.metaKey && event.key.toLowerCase() === "f" && !event.shiftKey) {
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

  // Main function for finding matches and generating highlight overlays
  const refreshSearch = useCallback(
    (scrollTo: ScrollToMatchOption = "none") => {
      const { results, closestToMiddle } = searchWithinContainer(
        searchRef,
        searchTerm,
        {
          caseSensitive,
          useRegex,
          offsetHeight: headerHeight,
        },
      );
      setMatches(results);
      // Find match closest to the middle of the view
      if (searchTerm.length > 1 && results.length) {
        if (scrollTo === "first") {
          scrollToMatch(results[0]);
        }
        if (scrollTo === "closest") {
          if (closestToMiddle) {
            scrollToMatch(closestToMiddle);
          }
        }
        if (scrollTo === "none") {
          if (closestToMiddle) {
            setCurrentMatch(closestToMiddle);
          } else {
            setCurrentMatch(results[0]);
          }
        }
      }
    },
    [
      searchTerm,
      caseSensitive,
      useRegex,
      searchRef,
      headerHeight,
      scrollToMatch,
    ],
  );

  // Triggers that should cause immediate refresh of results to closest search value:
  useEffect(() => {
    if (disabled || isResizing || !open) {
      setMatches([]);
    } else {
      refreshSearch("closest");
    }
  }, [refreshSearch, open, disabled, isResizing]);

  // Clicks in search div can cause content changes that for some reason don't trigger resize
  // Refresh clicking within container
  useEffect(() => {
    const searchContainer = searchRef.current;
    if (!open || !searchContainer) return;
    const handleSearchRefClick = () => {
      setTimeout(() => {
        refreshSearch("none");
      }, 150);
    };
    searchContainer.addEventListener("click", handleSearchRefClick);
    return () => {
      searchContainer.removeEventListener("click", handleSearchRefClick);
    };
  }, [searchRef, refreshSearch, open]);

  // Find widget component
  const widget = (
    <div
      className={`fixed top-0 z-50 transition-all ${open ? "" : "-translate-y-full"} bg-vsc-background right-0 flex flex-row items-center gap-1.5 rounded-bl-lg border-0 border-b border-l border-solid border-zinc-700 pl-[3px] pr-3 sm:gap-2`}
    >
      <Input
        disabled={disabled}
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

  // Generate the highlight overlay elements
  const highlights = useMemo(() => {
    return matches.map((match) => (
      <HighlightOverlay
        rectangle={match.overlayRectangle}
        isCurrent={currentMatch?.index === match.index}
      />
    ));
  }, [matches, currentMatch]);

  return {
    highlights,
    widget,
  };
};
