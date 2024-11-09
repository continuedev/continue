import React, { useRef, useEffect, useState, RefObject, useCallback } from 'react';
import { RootState } from '../../redux/store';
import { useSelector } from 'react-redux';
import { Button, HeaderButton, Input } from '..';
import useWindowSize from '../../hooks/useWindowSize';
import ButtonWithTooltip from '../ButtonWithTooltip';
import { ArrowDownIcon, ArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SearchMatch {
    index: number;
    textNode: Text
    overlayRectangle: Rectangle;
}

const SEARCH_DEBOUNCE = 500

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

export const useFindWidget = (searchRef: RefObject<HTMLDivElement>) => {
    // Search input
    const [currentMatch, setCurrentMatch] = useState<SearchMatch>();




    // Handle container resizing
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
            }, 200);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, [200]);

    // useEffect(() => {
    //     if (!searchRef.current) return
    //     let timeoutId: NodeJS.Timeout | null = null;

    //     // const handleResize = () => {
    //     //     if (timeoutId) {
    //     //         clearTimeout(timeoutId);
    //     //     }
    //     //     setIsMutating(true);

    //     //     timeoutId = setTimeout(() => {
    //     //         setIsMutating(false)
    //     //     }, 200);
    //     // };
    //     const observer = new MutationObserver(mutations => {
    //         if (timeoutId) {
    //             clearTimeout(timeoutId);
    //         }
    //         setIsMutating(true);

    //         timeoutId = setTimeout(() => {
    //             setIsMutating(false)
    //         }, 200);
    //         // mutations.forEach(mutation => {

    //         // });
    //     });
    //     observer.observe(searchRef.current, {
    //         // characterData: true,
    //         // childList: true, 
    //         attributes: true
    //     })
    //     return () => {
    //         if (timeoutId) {
    //             clearTimeout(timeoutId);
    //         }
    //         observer.disconnect();
    //     };
    // }, [searchRef.current]);






    const inputRef = useRef(null) as RefObject<HTMLInputElement>;
    const [input, setInput] = useState<string>("");

    const [debouncedInput, setDebouncedInput] = useState<string>("");
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


    const [open, setOpen] = useState<boolean>(false);
    const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
    const [useRegex, setUseRegex] = useState<boolean>(false);

    const active = useSelector((state: RootState) => state.state.active);

    const [matches, setMatches] = useState<SearchMatch[]>([]);

    const scrollToMatch = useCallback((match: SearchMatch) => {
        setCurrentMatch(match)
        searchRef.current.scrollTo({
            top: match.overlayRectangle.top - searchRef.current.clientHeight / 2,
            left: match.overlayRectangle.left - searchRef.current.clientWidth / 2,
            behavior: 'smooth'
        })
    }, [searchRef.current])

    const loadHighlights = useCallback((_query: string | undefined, scrollTo: 'first' | 'closest' | 'none' = 'none') => {
        if (!searchRef.current || !_query) {
            setMatches([]);
            return;
        };
        const query = caseSensitive ? _query : _query.toLowerCase()

        const textNodes: Text[] = [];
        const start = Date.now()
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
                startIndex += query.length; // Move past this match
                range.detach();
            }
        });
        console.log(`Found ${textNodes.length} nodes in ${Date.now() - start}ms`);
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

    useEffect(() => {
        if (active || !open || isResizing) setMatches([])
        else loadHighlights(debouncedInput, 'closest');
    }, [debouncedInput, loadHighlights, active, open, isResizing]);


    // Widget settings


    // Manage widget opened/close state
    const openWidget = useCallback(() => {
        setOpen(true);
        inputRef?.current.select()
    }, [setOpen, inputRef])

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

    const widget = (
        <div
            className={`z-50 fixed transition-all top-0 ${open ? '' : '-translate-y-full'} right-0 pr-3 flex flex-row items-center gap-2 rounded-bl-lg border-b border-solid border-0 border-l border-zinc-700 bg-vsc-background py-0.5 px-1`}
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
            <p className='whitespace-nowrap text-xs min-w-14 px-1 text-center'>
                {matches.length === 0 ? "No results" : `${(currentMatch?.index ?? 0) + 1} of ${matches.length}`}
            </p>
            <div className='flex flex-row gap-0.5'>
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

            {/* <button
                onClick={() => setUseRegex(curr => !curr)}
                className={`p-2 ${useRegex ? 'bg-blue-300' : 'bg-gray-300'} rounded hover:bg-blue-400`}
            >
                .*
            </button> */}
            <HeaderButton
                inverted={false}
                onClick={() => setOpen(false)}
            >
                <XMarkIcon className='h-4 w-4' />
            </HeaderButton>
        </div>
    )

    const highlights = matches.map(match => <HighlightOverlay {...match.overlayRectangle} isCurrent={currentMatch.index === match.index} />)

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