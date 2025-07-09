export function parsePartialXml(input: string): Record<string, any> | null {
  let stack: { tag: string; content: any }[] = [];
  let currentTag = "";
  let currentContent = "";
  let isInTag = false;
  let isClosingTag = false;
  let lastCompletedNestedTag = null;
  let lastCompletedContent = null;

  // Return null for non-XML content
  if (!input.includes("<")) {
    return null;
  }

  // If it's just starting a tag at the end, return empty
  if (input.trim().endsWith("<")) {
    return {};
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "<") {
      isInTag = true;
      isClosingTag = input[i + 1] === "/";

      // Save any content we've accumulated
      if (currentContent.trim() && stack.length > 0) {
        stack[stack.length - 1].content = currentContent.trim();
      }

      currentTag = "";
      currentContent = "";
      continue;
    }

    if (char === ">" || (isClosingTag && i === input.length - 1)) {
      isInTag = false;

      if (isClosingTag) {
        if (stack.length > 0) {
          const closed = stack.pop()!;
          const tagName = closed.tag;
          lastCompletedNestedTag = tagName;
          lastCompletedContent = closed.content;

          if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if (typeof parent.content !== "object") {
              parent.content = {};
            }
            parent.content[tagName] = closed.content;
          } else {
            return { [tagName]: closed.content };
          }
        }
      } else if (currentTag) {
        stack.push({ tag: currentTag, content: {} });
      }

      continue;
    }

    if (isInTag) {
      if (!isClosingTag && char !== "/") {
        currentTag += char;
      }
    } else {
      currentContent += char;
    }
  }

  // Handle partial XML
  if (stack.length > 0) {
    // Handle any remaining content
    if (currentContent.trim()) {
      const current = stack[stack.length - 1];
      if (stack.length > 1) {
        lastCompletedNestedTag = current.tag;
        lastCompletedContent = currentContent.trim();
      } else {
        current.content = currentContent.trim();
      }
    }

    // Create the result structure
    let result: Record<string, any> = {};
    let current = stack[0];

    // Special case for single tag with direct content
    if (stack.length === 1 && typeof current.content === "string") {
      return { [current.tag]: current.content };
    }

    result[current.tag] = {};
    let currentObj = result[current.tag];

    // If we have a completed nested tag, make sure it's included
    if (lastCompletedNestedTag && lastCompletedContent) {
      currentObj[lastCompletedNestedTag] = lastCompletedContent;
    }

    return result;
  }

  return {};
}
