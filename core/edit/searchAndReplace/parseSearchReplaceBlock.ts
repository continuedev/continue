// Search and replace block markers using flexible regex patterns
const SEARCH_BLOCK_START_REGEX = /^[-]{3,} SEARCH$/;
const SEARCH_BLOCK_END_REGEX = /^[=]{3,}$/;
const REPLACE_BLOCK_END_REGEX = /^[+]{3,} REPLACE$/;

export interface SearchReplaceBlockResult {
  /** Whether a complete search/replace block has been parsed */
  isComplete: boolean;
  /** The content to search for in the file */
  searchContent?: string;
  /** The content to replace the search content with */
  replaceContent?: string;
  /** Error message if parsing failed */
  error?: string;
}

/**
 * Parses a search and replace block from content.
 *
 * Expected format:
 * ------- SEARCH
 * [content to find]
 * =======
 * [content to replace with]
 * +++++++ REPLACE
 *
 * @param content - The content to parse
 * @returns ParseResult with completion status and extracted content
 */
export function parseSearchReplaceBlock(
  content: string,
): SearchReplaceBlockResult {
  const lines = content.split("\n");

  let currentSearchContent = "";
  let currentReplaceContent = "";
  let inSearch = false;
  let inReplace = false;

  for (const line of lines) {
    if (SEARCH_BLOCK_START_REGEX.test(line)) {
      inSearch = true;
      inReplace = false;
      currentSearchContent = "";
      currentReplaceContent = "";
      continue;
    }

    if (SEARCH_BLOCK_END_REGEX.test(line)) {
      if (!inSearch) {
        return {
          isComplete: false,
          error: "Found search block end marker without matching start marker",
        };
      }
      inSearch = false;
      inReplace = true;
      continue;
    }

    if (REPLACE_BLOCK_END_REGEX.test(line)) {
      if (!inReplace) {
        return {
          isComplete: false,
          error:
            "Found replace block end marker without matching replace start marker",
        };
      }

      // Complete block found
      return {
        isComplete: true,
        searchContent: currentSearchContent.trim(),
        replaceContent: currentReplaceContent.trim(),
      };
    }

    // Accumulate content
    if (inSearch) {
      currentSearchContent += line + "\n";
    } else if (inReplace) {
      currentReplaceContent += line + "\n";
    }
  }

  // Block is not yet complete
  return {
    isComplete: false,
    searchContent: currentSearchContent.trim(),
    replaceContent: currentReplaceContent.trim(),
  };
}

/**
 * Parses all complete search and replace blocks from content.
 *
 * @param content - The content containing multiple search/replace blocks
 * @returns Array of complete search/replace blocks found
 * @throws Error if any malformed blocks are encountered
 */
export function parseAllSearchReplaceBlocks(
  content: string,
): SearchReplaceBlockResult[] {
  const blocks: SearchReplaceBlockResult[] = [];
  const lines = content.split("\n");

  let currentBlockLines: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (SEARCH_BLOCK_START_REGEX.test(line)) {
      // Start of new block
      if (inBlock && currentBlockLines.length > 0) {
        // Process previous incomplete block if any
        const blockContent = currentBlockLines.join("\n");
        const result = parseSearchReplaceBlock(blockContent);
        if (result.isComplete) {
          blocks.push(result);
        } else if (result.error) {
          // Fail fast on any parsing error
          throw new Error(result.error);
        }
        // If incomplete but no error, it's just a partial block - continue processing
      }
      currentBlockLines = [line];
      inBlock = true;
    } else if (inBlock) {
      currentBlockLines.push(line);

      // Check if this line completes the current block
      if (REPLACE_BLOCK_END_REGEX.test(line)) {
        const blockContent = currentBlockLines.join("\n");
        const result = parseSearchReplaceBlock(blockContent);
        if (result.isComplete) {
          blocks.push(result);
        } else if (result.error) {
          // Fail fast on any parsing error
          throw new Error(result.error);
        }
        currentBlockLines = [];
        inBlock = false;
      }
    }
  }

  return blocks;
}
