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
import { useSelector } from "react-redux";
import { HeaderButton, Input } from "..";
import { RootState } from "../../redux/store";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import { useAppSelector } from "../../redux/hooks";

interface SearchMatch {
  index: number;
  textNode: Text;
  overlayRectangle: Rectangle;
}

type ScrollToMatchOption = "closest" | "first" | "none";

const SEARCH_DEBOUNCE = 300;
const RESIZE_DEBOUNCE = 200;

interface Rectangle {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface HighlightOverlayProps extends Rectangle {
  isCurrent: boolean;
}

const HighlightOverlay = (props: HighlightOverlayProps) => {
  const { isCurrent, top, left, width, height } = props;
  return (
    <div
      className={isCurrent ? "bg-vsc-find-match-selected" : "bg-blue-200/30"} // bg-vsc-find-match can"t get to work
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

/*
    useFindWidget takes a container ref and returns
    1. A widget that can be placed anywhere to search the contents of that container
    2. Search results and state
    3. Highlight components to be overlayed over the container

    Container must have relative positioning
*/
export const useFindWidget = (searchRef: RefObject<HTMLDivElement>) => {
  // Search input, debounced
  const [input, setInput] = useState<string>("");
  const debouncedInput = useRef<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Widget open/closed state
  const [open, setOpen] = useState<boolean>(false);
  const openWidget = useCallback(() => {
    setOpen(true);
    inputRef?.current?.select();
  }, [setOpen, inputRef]);

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
    [searchRef.current],
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
  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    if (!searchRef?.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsResizing(true);
      timeoutId = setTimeout(() => {
        setIsResizing(false);
      }, RESIZE_DEBOUNCE);
    });

    resizeObserver.observe(searchRef.current);
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (searchRef.current) resizeObserver.unobserve(searchRef.current);
    };
  }, [searchRef.current]);

  // Main function for finding matches and generating highlight overlays
  const refreshSearch = useCallback(
    (scrollTo: ScrollToMatchOption = "none", clearFirst = false) => {
      if (clearFirst) setMatches([]);

      const searchContainer = searchRef.current;

      const _query = debouncedInput.current; // trimStart - decided no because spaces should be fully searchable
      if (!searchContainer || !_query) {
        setMatches([]);
        return;
      }
      const query = caseSensitive ? _query : _query.toLowerCase();

      // First grab all text nodes
      // Skips any elements with the "find-widget-skip" class
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(
        searchRef.current,
        NodeFilter.SHOW_ALL,
        {
          acceptNode: (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if ((node as Element).classList.contains("find-widget-skip"))
                return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            } else if (node.nodeType === Node.TEXT_NODE) {
              if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
              const nodeValue = caseSensitive
                ? node.nodeValue
                : node.nodeValue.toLowerCase();
              if (nodeValue.includes(query)) return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          },
        },
      );

      while (walker.nextNode()) {
        if (walker.currentNode.nodeType === Node.ELEMENT_NODE) continue;
        textNodes.push(walker.currentNode as Text);
      }

      // Now walk through each node match and extract search results
      // One node can have several matches
      const newMatches: SearchMatch[] = [];
      textNodes.forEach((textNode, idx) => {
        // Hacky way to detect code blocks that be wider than client and cause absolute positioning to fail
        const highlightFullLine =
          textNode.parentElement?.className.includes("hljs");

        let nodeTextValue = caseSensitive
          ? textNode.nodeValue
          : textNode.nodeValue.toLowerCase();
        let startIndex = 0;
        while ((startIndex = nodeTextValue.indexOf(query, startIndex)) !== -1) {
          // Create a range to measure the size and position of the match
          const range = document.createRange();
          range.setStart(textNode, startIndex);
          const endIndex = startIndex + query.length;
          range.setEnd(textNode, endIndex);
          const rect = range.getBoundingClientRect();
          range.detach();
          startIndex = endIndex;

          const top =
            rect.top + searchContainer.clientTop + searchContainer.scrollTop;
          const left =
            rect.left + searchContainer.clientLeft + searchContainer.scrollLeft;

          // Build a match result and push to matches
          const newMatch: SearchMatch = {
            index: 0, // will set later
            textNode,
            overlayRectangle: {
              top,
              left: highlightFullLine ? 2 : left,
              width: highlightFullLine
                ? searchContainer.clientWidth - 4
                : rect.width, // equivalent of adding 2 px x padding
              height: rect.height,
            },
          };
          newMatches.push(newMatch);

          if (highlightFullLine) {
            break; // Since highlighting full line no need for multiple overlays, will cause darker highlight
          }
        }
      });

      // There will still be duplicate full lines when multiple text nodes are in the same line (e.g. Code highlights)
      // Filter them out by using the overlay rectangle as a hash key
      const matchHash = Object.fromEntries(
        newMatches.map((match) => [
          JSON.stringify(match.overlayRectangle),
          match,
        ]),
      );
      const filteredMatches = Object.values(matchHash).map((match, index) => ({
        ...match,
        index,
      }));

      // Find match closest to the middle of the view
      const verticalMiddle =
        searchRef.current.scrollTop + searchRef.current.clientHeight / 2;
      let closestDist = Infinity;
      let closestMatchToMiddle: SearchMatch | null = null;
      filteredMatches.forEach((match) => {
        const dist = Math.abs(verticalMiddle - match.overlayRectangle.top);
        if (dist < closestDist) {
          closestDist = dist;
          closestMatchToMiddle = match;
        }
      });

      // Update matches and scroll to the closest or first match
      setMatches(filteredMatches);
      if (query.length > 1 && filteredMatches.length) {
        if (scrollTo === "first") {
          scrollToMatch(filteredMatches[0]);
        }
        if (scrollTo === "closest") {
          if (closestMatchToMiddle) {
            scrollToMatch(closestMatchToMiddle);
          }
        }
        if (scrollTo === "none") {
          if (closestMatchToMiddle) {
            setCurrentMatch(closestMatchToMiddle);
          } else {
            setCurrentMatch(filteredMatches[0]);
          }
        }
      }
    },
    [searchRef.current, debouncedInput, scrollToMatch, caseSensitive, useRegex],
  );

  // Triggers that should cause immediate refresh of results to closest search value:
  // Input change (debounced) and window click
  const lastUpdateRef = useRef(0);
  useEffect(() => {
    const debounce = () => {
      debouncedInput.current = input;
      lastUpdateRef.current = Date.now();
      refreshSearch("closest");
    };
    const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
    if (timeSinceLastUpdate >= SEARCH_DEBOUNCE) {
      debounce();
    } else {
      const handler = setTimeout(() => {
        debounce();
      }, SEARCH_DEBOUNCE - timeSinceLastUpdate);
      return () => {
        clearTimeout(handler);
      };
    }
  }, [refreshSearch, input]);

  // Could consider doing any window click but I only handled search div here
  // Since usually only clicks in search div will cause content changes in search div
  useEffect(() => {
    const searchContainer = searchRef.current;
    if (!open || !searchContainer) return;
    const handleSearchRefClick = () => {
      refreshSearch("none");
    };
    searchContainer.addEventListener("click", handleSearchRefClick);
    return () => {
      searchContainer.removeEventListener("click", handleSearchRefClick);
    };
  }, [searchRef.current, refreshSearch, open]);

  // Triggers that should cause results to temporarily disappear and then reload
  // Active = LLM is generating, etc.
  const active = useAppSelector((state) => state.session.isStreaming);

  useEffect(() => {
    if (active || isResizing) setMatches([]);
    else refreshSearch("none");
  }, [refreshSearch, active]);

  useEffect(() => {
    if (!open) setMatches([]);
    else refreshSearch("closest");
  }, [refreshSearch, open]);

  useEffect(() => {
    refreshSearch("closest");
  }, [refreshSearch, caseSensitive, useRegex]);

  // Find widget component
  const widget = useMemo(() => {
    return (
      <div
        className={`fixed top-0 z-50 transition-all ${open ? "" : "-translate-y-full"} bg-vsc-background right-0 flex flex-row items-center gap-1.5 rounded-bl-lg border-0 border-b border-l border-solid border-zinc-700 pl-[3px] pr-3 sm:gap-2`}
      >
        <Input
          disabled={active}
          type="text"
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
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
            disabled={matches.length < 2 || active}
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
            disabled={matches.length < 2 || active}
          >
            <ArrowDownIcon className="h-4 w-4" />
          </HeaderButtonWithToolTip>
        </div>
        <HeaderButtonWithToolTip
          disabled={active}
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
  }, [
    open,
    input,
    inputRef,
    caseSensitive,
    matches,
    currentMatch,
    previousMatch,
    nextMatch,
  ]);

  // Generate the highlight overlay elements
  const highlights = useMemo(() => {
    return matches.map((match) => (
      <HighlightOverlay
        {...match.overlayRectangle}
        isCurrent={currentMatch?.index === match.index}
      />
    ));
  }, [matches, currentMatch]);

  return {
    matches,
    highlights,
    inputRef,
    input: debouncedInput,
    setInput,
    open,
    setOpen,
    widget,
  };
};
