export interface SearchMatch {
  index: number;
  textNode: Text;
  overlayRectangle: Rectangle;
}


const refreshSearch = (scrollTo: ScrollToMatchOption = "none", clearFirst = false) => {
      if (clearFirst) setMatches([]);

      const searchContainer = searchRef.current;
      const header = headerRef.current;

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

          const headerHeight = header?.clientHeight ?? 0;

          const top =
            rect.top +
            searchContainer.clientTop +
            searchContainer.scrollTop -
            headerHeight;
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
    [
      headerRef,
      searchRef,
      debouncedInput,
      scrollToMatch,
      caseSensitive,
      useRegex,
      ...refreshDependencies,
    ],
}