import React, { useRef, useEffect, useState, RefObject, useCallback, useMemo } from 'react';
import { RootState } from '../../redux/store';
import { useSelector } from 'react-redux';
import { Button, HeaderButton, Input } from '..';
import ButtonWithTooltip from '../ButtonWithTooltip';
import { ArrowDownIcon, ArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SearchMatch {
    index: number;
    textNode: Text
    overlayRectangle: Rectangle;
}

const SEARCH_DEBOUNCE = 500
const RESIZE_DEBOUNCE = 200

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
            className={isCurrent ? 'bg-vsc-find-match-selected' : 'bg-blue-200/30'} // bg-vsc-find-match can't get to work
            key={`highlight-${top}-${left}`}
            style={{
                position: 'absolute',
                top,
                left,
                width,
                height,
                pointerEvents: 'none', // To click through the overlay
                zIndex: 10,
            }}
        />
    )
}

/*
    useFindWidget takes a container ref and returns
    1. A widget that can be placed anywhere to search the contents of that container
    2. Search results and state
    3. Highlight components to be overlayed over the container

    Container must have relative positioning
*/
export const useFindWidget = (searchRef: RefObject<HTMLDivElement>) => {
    // Used to disable search when chat is loading
    const active = useSelector((state: RootState) => state.state.active);

    // Search input, debounced
    const [input, setInput] = useState<string>("");
    const [debouncedInput, setDebouncedInput] = useState<string>("");
    const inputRef = useRef(null) as RefObject<HTMLInputElement>;
    const lastUpdateRef = useRef(0);

    useEffect(() => {
        const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
        if (timeSinceLastUpdate >= SEARCH_DEBOUNCE) {
            setDebouncedInput(input);
            lastUpdateRef.current = Date.now();
        } else {
            const handler = setTimeout(() => {
                setDebouncedInput(input);
                lastUpdateRef.current = Date.now();
            }, SEARCH_DEBOUNCE - timeSinceLastUpdate);
            return () => {
                clearTimeout(handler);
            };
        }
    }, [input]);

    // Widget open/closed state
    const [open, setOpen] = useState<boolean>(false);
    const openWidget = useCallback(() => {
        setOpen(true);
        inputRef?.current.select()
    }, [setOpen, inputRef])

    // Search settings and results
    const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
    const [useRegex, setUseRegex] = useState<boolean>(false);

    const [matches, setMatches] = useState<SearchMatch[]>([]);
    const [currentMatch, setCurrentMatch] = useState<SearchMatch>();

    // Navigating between search results
    // The "current" search result is highlighted a different color
    const scrollToMatch = useCallback((match: SearchMatch) => {
        setCurrentMatch(match)
        searchRef.current.scrollTo({
            top: match.overlayRectangle.top - searchRef.current.clientHeight / 2,
            left: match.overlayRectangle.left - searchRef.current.clientWidth / 2,
            behavior: 'smooth'
        })
    }, [searchRef.current])

    const nextMatch = useCallback(() => {
        if (matches.length === 0) return
        const newIndex = (currentMatch.index + 1) % matches.length;
        const newMatch = matches[newIndex]
        scrollToMatch(newMatch)
    }, [scrollToMatch, currentMatch, matches])

    const previousMatch = useCallback(() => {
        if (matches.length === 0) return
        const newIndex = currentMatch.index === 0 ? matches.length - 1 : currentMatch.index - 1
        const newMatch = matches[newIndex]
        scrollToMatch(newMatch)
    }, [scrollToMatch, currentMatch, matches])

    // Handle keyboard shortcuts for navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                event.stopPropagation();
                openWidget();
            } else if (document.activeElement === inputRef.current) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                } else if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.shiftKey) previousMatch()
                    else nextMatch()
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [inputRef, matches, nextMatch]);

    // Handle container resize changes - highlight positions must adjust
    const [isResizing, setIsResizing] = useState(false);
    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null;
        const handleResize = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            setIsResizing(true);
            timeoutId = setTimeout(() => {
                setIsResizing(false)
            }, RESIZE_DEBOUNCE);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // The bread and butter: 
    // 
    const loadHighlights = useCallback((_query: string | undefined, scrollTo: 'first' | 'closest' | 'none' = 'none') => {
        if (!searchRef.current || !_query) {
            setMatches([]);
            return;
        };
        const query = caseSensitive ? _query : _query.toLowerCase()

        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(
            searchRef.current,
            NodeFilter.SHOW_ALL,
            {
                acceptNode: (node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if ((node as Element).classList.contains('find-widget-skip')) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    } else if (node.nodeType === Node.TEXT_NODE) {
                        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                        const nodeValue = caseSensitive ? node.nodeValue : node.nodeValue.toLowerCase()
                        if (nodeValue.includes(query)) return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT
                }
            }
        );

        while (walker.nextNode()) {
            if (walker.currentNode.nodeType === Node.ELEMENT_NODE) continue
            textNodes.push(walker.currentNode as Text);
        }

        const newMatches: SearchMatch[] = [];
        let index = 0;

        // For finding closest match
        const verticalMiddle = searchRef.current.scrollTop + searchRef.current.clientHeight / 2
        let closestDist = Infinity
        let closestMatchToMiddle: SearchMatch | null = null

        textNodes.forEach(textNode => {
            let nodeTextValue = caseSensitive ? textNode.nodeValue : textNode.nodeValue.toLowerCase();
            let startIndex = 0;
            while ((startIndex = nodeTextValue.indexOf(query, startIndex)) !== -1) {
                // Create a range to measure the size and position of the match
                const range = document.createRange();
                range.setStart(textNode, startIndex);
                range.setEnd(textNode, startIndex + query.length);

                const rect = range.getBoundingClientRect();
                const top = rect.top + searchRef.current.clientTop + searchRef.current.scrollTop
                const left = rect.left + searchRef.current.clientLeft + searchRef.current.scrollLeft;

                // Hacky way to detect code blocks that be wider than client and cause absolute positioning to fail
                const highlightFullLine = textNode.parentElement.className.includes('hljs')

                const newMatch: SearchMatch = {
                    index,
                    textNode,
                    overlayRectangle: {
                        top,
                        left: highlightFullLine ? 2 : left,
                        width: highlightFullLine ? (searchRef.current.clientWidth - 4) : rect.width,
                        height: rect.height,
                    }
                }
                newMatches.push(newMatch);

                const dist = Math.abs(verticalMiddle - top);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestMatchToMiddle = newMatch
                }

                index++;
                startIndex += query.length;
                range.detach();
            }
        });

        setMatches(newMatches);
        if (query.length > 1 && newMatches.length) {
            if (scrollTo === 'first') {
                scrollToMatch(newMatches[0]);
            }
            if (scrollTo === 'closest' && closestMatchToMiddle) {
                scrollToMatch(closestMatchToMiddle)
            }
        }
    }, [searchRef.current, caseSensitive, useRegex, scrollToMatch])

    // Trigger searches or clearing results on state changes
    useEffect(() => {
        if (active || !open || isResizing) setMatches([])
        else loadHighlights(debouncedInput, 'closest');
    }, [debouncedInput, loadHighlights, active, open, isResizing]);

    // Find widget component
    const widget = useMemo(() => {
        return (
            <div
                className={`z-50 fixed transition-all top-0 ${open ? '' : '-translate-y-full'} right-0 pr-3 flex flex-row items-center gap-1.5 sm:gap-2 rounded-bl-lg border-b border-solid border-0 border-l border-zinc-700 bg-vsc-background pl-[3px]`}
            >
                <Input
                    type="text"
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                    }}
                    placeholder="Search..."
                />
                <p className='hidden xs:block whitespace-nowrap text-xs min-w-14 px-1 text-center'>
                    {matches.length === 0 ? "No results" : `${(currentMatch?.index ?? 0) + 1} of ${matches.length}`}
                </p>
                <div className='hidden sm:flex flex-row gap-0.5'>
                    <ButtonWithTooltip
                        tooltipPlacement="top-end"
                        text={"Previous Match"}
                        onClick={previousMatch}
                        className='h-4 w-4'
                        disabled={matches.length < 2}
                    >
                        <ArrowUpIcon className='h-4 w-4' />
                    </ButtonWithTooltip>
                    <ButtonWithTooltip
                        tooltipPlacement="top-end"
                        text={"Next Match"}
                        onClick={nextMatch}
                        className='h-4 w-4'
                        disabled={matches.length < 2}
                    >
                        <ArrowDownIcon className='h-4 w-4' />
                    </ButtonWithTooltip>
                </div>
                <ButtonWithTooltip
                    inverted={caseSensitive}
                    tooltipPlacement="top-end"
                    text={caseSensitive ? "Turn off case sensitivity" : "Turn on case sensitivity"}
                    onClick={() => setCaseSensitive(curr => !curr)}
                    className='h-4 w-4 text-xs'
                >
                    Aa
                </ButtonWithTooltip>
                {/* TODO - add useRegex functionality */}
                <HeaderButton
                    inverted={false}
                    onClick={() => setOpen(false)}
                >
                    <XMarkIcon className='h-4 w-4' />
                </HeaderButton>
            </div>
        )
    }, [open, input, inputRef, caseSensitive, matches, currentMatch, previousMatch, nextMatch])

    // Generate the highlight overlay elements
    const highlights = useMemo(() => {
        return matches.map(match => <HighlightOverlay {...match.overlayRectangle} isCurrent={currentMatch.index === match.index} />)
    }, [matches, currentMatch])

    return {
        matches,
        highlights,
        inputRef,
        input: debouncedInput,
        setInput,
        open,
        setOpen,
        widget
    }
}