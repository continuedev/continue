import React, { useRef, useEffect, useState, RefObject, useCallback } from 'react';
import { RootState } from '../../redux/store';
import { useSelector } from 'react-redux';
import { Input } from '..';

interface FindWidgetProps {
    searchRef: RefObject<HTMLDivElement>;
}

interface HighlightedNode {
    isCurrent: boolean;
    node: Text
    overlay: JSX.Element
}


const FindWidget = ({ searchRef }: FindWidgetProps) => {
    // Search input
    const inputRef = useRef(null) as RefObject<HTMLInputElement>;
    const [input, setInput] = useState<string>("");

    const active = useSelector((state: RootState) => state.state.active);

    // const [matches, setMatches] = useState<string[]>();
    const [highlights, setHighlights] = useState<HighlightedNode[]>([]);

    const [currentIndex, setCurrentIndex] = useState<number>(0);

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
    const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
    const [useRegex, setUseRegex] = useState<boolean>(false);



    const refreshHighlights = useCallback((query: string | undefined) => {
        if (!searchRef.current || !query || active || !open) {
            setHighlights([]);
            return;
        };
        // debugger
        console.log(query)
        const textNodes: Text[] = [];
        const start = Date.now()
        const walker = document.createTreeWalker(
            searchRef.current,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    console.log('checking node')
                    if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                    if (node.parentElement?.classList.contains('find-widget-skip')) return NodeFilter.FILTER_REJECT;
                    if (node.nodeValue.includes(query)) return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode as Text);
        }
        console.log(`Found ${textNodes.length} matches in ${Date.now() - start}ms`);

        const newHighlights: HighlightedNode[] = [];
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

                // Create an overlay element
                newHighlights.push({
                    isCurrent: isFirst,
                    node: textNode,
                    overlay: <div
                        className={isFirst ? 'bg-vsc-find-match-selected' : 'bg-vsc-find-match'}
                        key={`${rect.top}-${rect.left}`}
                        style={{
                            position: 'absolute',
                            top: rect.top,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                            // backgroundColor: 'rgba(255, 255, 0, 0.5)',
                            pointerEvents: 'none', // To click through the overlay
                            zIndex: 10,
                        }}
                    />
                });
                isFirst = false

                startIndex += query.length; // Move past this match
                range.detach();
            }
        });

        setHighlights(newHighlights);
    }, [searchRef, setHighlights, active])

    useEffect(() => {
        refreshHighlights(input)
    }, [input, refreshHighlights]);

    const resetHighlights = useCallback(() => {
        refreshHighlights(inputRef.current?.value);
    }, [refreshHighlights, inputRef]);

    // Widget settings toggles
    const toggleCaseSensitive = useCallback(() => {
        setCaseSensitive(prev => !prev);
        resetHighlights()
    }, [setCaseSensitive, resetHighlights]);

    const toggleUseRegex = useCallback(() => {
        setUseRegex(prev => !prev);
        resetHighlights()
    }, [setUseRegex, resetHighlights])

    // Manage widget opened/close state
    const [open, setOpen] = useState<boolean>(false);
    const openWidget = useCallback(() => {
        setOpen(true);
        inputRef?.current.focus()
    }, [setOpen, inputRef])
    const closeWidget = useCallback(() => {
        setOpen(false);
    }, [setOpen])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                event.stopPropagation();
                openWidget();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeWidget();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return <>
        <div
            className={`z-50 fixed transition-all top-0 ${open ? '' : '-translate-y-full'} right-0 flex gap-2 bg-vsc-background`}
        >
            <Input
                type="text"
                ref={inputRef}
                value={input}
                onChange={(e) => {
                    setInput(e.target.value);
                }}
                placeholder="Search..."
                className="flex-grow p-2 border rounded"
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
            <button
                onClick={toggleCaseSensitive}
                className={`p-2 ${caseSensitive ? 'bg-blue-300' : 'bg-gray-300'} rounded hover:bg-blue-400`}
            >
                Aa
            </button>
            <button
                onClick={toggleUseRegex}
                className={`p-2 ${useRegex ? 'bg-blue-300' : 'bg-gray-300'} rounded hover:bg-blue-400`}
            >
                .*
            </button>
            <button
                onClick={closeWidget}
            >
                x
            </button>
        </div>
        {open ?
            highlights.map(highlight => highlight.overlay)
            : null}
    </>;
};

export default FindWidget;
