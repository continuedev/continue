export interface Rectangle {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SearchMatch {
  index: number;
  textNode: Text;
  overlayRectangle: Rectangle;
}

interface SearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
  offsetHeight: number;
}

export const searchWithinContainer = (
  containerRef: React.RefObject<HTMLDivElement>,
  searchQuery: string,
  options: SearchOptions,
): {
  results: SearchMatch[];
  closestToMiddle: SearchMatch | null;
} => {
  const searchContainer = containerRef.current;

  if (!searchContainer || !searchQuery) {
    return {
      results: [],
      closestToMiddle: null,
    };
  }
  const query = options.caseSensitive ? searchQuery : searchQuery.toLowerCase();

  // First grab all text nodes
  // Skips any elements with the "find-widget-skip" class
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    searchContainer,
    NodeFilter.SHOW_ALL,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if ((node as Element).classList.contains("find-widget-skip"))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        } else if (node.nodeType === Node.TEXT_NODE) {
          if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
          const nodeValue = options.caseSensitive
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

    let nodeTextValue = options.caseSensitive
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
        rect.top +
        searchContainer.clientTop +
        searchContainer.scrollTop -
        options.offsetHeight;

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
    newMatches.map((match) => [JSON.stringify(match.overlayRectangle), match]),
  );
  const filteredMatches = Object.values(matchHash).map((match, index) => ({
    ...match,
    index,
  }));

  // Find the match closest to the vertical middle of the container
  const verticalMiddle =
    searchContainer.scrollTop + searchContainer.clientHeight / 2;
  let closestDist = Infinity;
  let closestMatchToMiddle: SearchMatch | null = null;
  filteredMatches.forEach((match) => {
    const dist = Math.abs(verticalMiddle - match.overlayRectangle.top);
    if (dist < closestDist) {
      closestDist = dist;
      closestMatchToMiddle = match;
    }
  });

  return {
    results: filteredMatches,
    closestToMiddle: closestMatchToMiddle,
  };
};
