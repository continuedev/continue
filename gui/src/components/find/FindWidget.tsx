import React, { useRef, useEffect, useState, RefObject, useCallback } from 'react';
import { RootState } from '../../redux/store';
import { useSelector } from 'react-redux';
import { Button, HeaderButton, Input } from '..';
import useWindowSize from '../../hooks/useWindowSize';
import ButtonWithTooltip from '../ButtonWithTooltip';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface SearchMatch {
    isCurrent: boolean;
    textNode: Text
    overlayNode: JSX.Element;
}

const SEARCH_DEBOUNCE = 300
export const useFindWidget = (searchRef: RefObject<HTMLDivElement>) => {
    // Search input
    // const [currentIndex, setCurrentIndex] = useState<number>(0);

    const { isResizing } = useWindowSize(200)
    // console.log(isResizing)

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

    const loadHighlights = useCallback((query: string | undefined) => {
        if (!searchRef.current || !query) {
            setMatches([]);
            return;
        };
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
                        if (node.nodeValue.includes(query)) return NodeFilter.FILTER_ACCEPT;
                    }
                    else return NodeFilter.FILTER_REJECT
                }
            }
        );

        while (walker.nextNode()) {
            if (walker.currentNode.nodeType === Node.ELEMENT_NODE) continue
            textNodes.push(walker.currentNode as Text);
        }


        const newMatches: SearchMatch[] = [];
        let isFirst = true
        textNodes.forEach(textNode => {
            let nodeTextValue = textNode.nodeValue || '';
            let startIndex = 0;

            while ((startIndex = nodeTextValue.indexOf(query, startIndex)) !== -1) {
                // Create a range to measure the size and position of the match
                // if(textNode.)
                const range = document.createRange();
                range.setStart(textNode, startIndex);
                range.setEnd(textNode, startIndex + query.length);

                const rect = range.getBoundingClientRect();

                const overlayNode = <div
                    className={isFirst ? 'bg-vsc-find-match-selected' : 'bg-vsc-find-match'}
                    key={`highlight-${rect.top}-${rect.left}`}
                    style={{
                        position: 'absolute',
                        top: rect.top + searchRef.current.clientTop + searchRef.current.scrollTop,
                        left: rect.left + searchRef.current.clientLeft + searchRef.current.scrollLeft,
                        width: rect.width,
                        height: rect.height,
                        // backgroundColor: 'rgba(255, 255, 0, 0.5)',
                        pointerEvents: 'none', // To click through the overlay
                        zIndex: 10,
                    }}
                />

                // Create an overlay element
                newMatches.push({
                    isCurrent: isFirst,
                    textNode,
                    overlayNode
                });
                isFirst = false

                startIndex += query.length; // Move past this match
                range.detach();
            }
        });
        console.log(`Found ${textNodes.length} nodes in ${Date.now() - start}ms`);
        setMatches(newMatches);
    }, [searchRef.current, setMatches])

    useEffect(() => {
        if (active || !open || isResizing) setMatches([])
        else loadHighlights(debouncedInput);
    }, [debouncedInput, loadHighlights, active, open, useRegex, caseSensitive, isResizing]);


    // const selectMatch = (index: number) => {
    //     if (!highlightedNodes.length) return;
    //     highlightedNodes[currentIndex].className = 'find-highlight';

    //     const newIndex = (index + highlightedNodes.length) % highlightedNodes.length;
    //     setCurrentIndex(newIndex);

    //     const currentNode = highlightedNodes[newIndex];
    //     if (currentNode) {
    //         currentNode.className = 'find-highlight-selected';
    //         currentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    //     }
    // }

    // const nextMatch = () => selectMatch(currentIndex + 1);
    // const previousMatch = () => selectMatch(currentIndex - 1);

    // Widget settings


    // Manage widget opened/close state
    const openWidget = useCallback(() => {
        setOpen(true);
        inputRef?.current.focus()
    }, [setOpen, inputRef])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                event.stopPropagation();
                openWidget();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const widget = (
        <div
            className={`z-50 fixed transition-all top-0 ${open ? '' : '-translate-y-full'} right-0 pr-3 flex flex-row items-center gap-2 rounded-bl-sm bg-vsc-background py-0.5 px-1`}
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

            {/* <button
            onClick={previousMatch}
            className="p-2 bg-gray-300 rounded hover:bg-gray-400"
        >
            ⬆️
        </button>
        <button
            onClick={nextMatch}
            className="p-2 bg-gray-300 rounded hover:bg-gray-400"
        >
            ⬇️
        </button> */}
            <ButtonWithTooltip
                inverted={caseSensitive}
                tooltipPlacement="top-end"
                text={caseSensitive ? "Turn off case sensitivity" : "Turn on case sensitivity"}
                onClick={() => setCaseSensitive(curr => !curr)}
                className='h-5 w-5'
            >

                Aa
                {/* <EllipsisHorizontalCircleIcon className="h-4 w-4" /> */}
            </ButtonWithTooltip>

            <button
                onClick={() => setUseRegex(curr => !curr)}
                className={`p-2 ${useRegex ? 'bg-blue-300' : 'bg-gray-300'} rounded hover:bg-blue-400`}
            >
                .*
            </button>
            <HeaderButton
                inverted={false}
                // tooltipPlacement="top-end"
                // text={"Close search"}
                onClick={() => setOpen(false)}
            // className='h-5 w-5'
            >
                <XMarkIcon className='h-4 w-4' />
                {/* <EllipsisHorizontalCircleIcon className="h-4 w-4" /> */}
            </HeaderButton>
        </div>
    )

    return {
        matches,
        highlights: matches.map(match => match.overlayNode),
        inputRef,
        input: debouncedInput,
        setInput,
        open,
        setOpen,
        widget
    }
}