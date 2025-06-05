import { countTokens, pruneStringFromBottom } from "../../llm/countTokens";
import { AutocompleteSnippet } from "../snippets/types";
import { HelperVars } from "../util/HelperVars";

let logMin: number;
let logMax: number;

// when ranking files according to scores
const numFilesConsidered = 10;
const defaultNumFilesUsed = 5;

// for scores
const recencyWeight = 0.5;
const sizeWeight = 0.5;

const minSize = 10; // for numerical stability in log computations

const minTokensInSnippet = 125;

// Reduces opened file snippets to fit within the remaining amount of tokens
export function formatOpenedFilesContext(
  recentlyOpenedFilesSnippets: AutocompleteSnippet[],
  remainingTokenCount: number,
  helper: HelperVars,
  alreadyAddedSnippets: AutocompleteSnippet[], // TODO use this to deduplicate context
  TOKEN_BUFFER: number,
): AutocompleteSnippet[] {
  if (recentlyOpenedFilesSnippets.length === 0) {
    return [];
  }

  // Calculate how many full snippets would fit within the remaining token count
  let numSnippetsThatFit = 0;
  let totalTokens = 0;

  const numFilesUsed = Math.min(
    defaultNumFilesUsed,
    recentlyOpenedFilesSnippets.length,
  );

  for (let i = 0; i < recentlyOpenedFilesSnippets.length; i++) {
    const snippetTokens = countTokens(
      recentlyOpenedFilesSnippets[i].content,
      helper.modelName,
    );
    if (totalTokens + snippetTokens < remainingTokenCount - TOKEN_BUFFER) {
      totalTokens += snippetTokens;
      numSnippetsThatFit++;
    } else {
      break;
    }
  }

  // if we can fit all untrimmed snippets, or more than some default value, return the untrimmed snippets
  if (numSnippetsThatFit >= numFilesUsed) {
    return recentlyOpenedFilesSnippets.slice(0, numSnippetsThatFit);
  }

  // If we can't fit all these, we need to adaptively trim them.
  setLogStats(recentlyOpenedFilesSnippets);
  const topScoredSnippets = rankByScore(recentlyOpenedFilesSnippets);
  let N = topScoredSnippets.length;
  while (remainingTokenCount - TOKEN_BUFFER < N * minTokensInSnippet) {
    topScoredSnippets.pop();
    N = topScoredSnippets.length;
    if (N === 0) break;
  }

  let trimmedSnippets = new Array<AutocompleteSnippet>();

  while (N > 0) {
    let W = 2 / (N + 1);
    let snippetTokenLimit = Math.floor(
      minTokensInSnippet +
        W * (remainingTokenCount - TOKEN_BUFFER - N * minTokensInSnippet),
    );

    let trimmedSnippetAndTokenCount = trimSnippetForContext(
      topScoredSnippets[0],
      snippetTokenLimit,
      helper.modelName,
    );
    trimmedSnippets.push(trimmedSnippetAndTokenCount.newSnippet);
    remainingTokenCount -= trimmedSnippetAndTokenCount.newTokens;
    topScoredSnippets.shift();
    N = topScoredSnippets.length;
  }

  return trimmedSnippets;
}

// Rank snippets by recency and size
const rankByScore = (
  snippets: AutocompleteSnippet[],
): AutocompleteSnippet[] => {
  if (snippets.length === 0) return [];

  // Keep only the top numFilesConsidered elements (or all if fewer)
  const topSnippets = snippets.slice(0, numFilesConsidered);

  // Sort by score (using original index for recency calculation)
  const scoredSnippets = topSnippets.map((snippet, i) => ({
    snippet,
    originalIndex: i,
    score: getRecencyAndSizeScore(i, snippet),
  }));

  scoredSnippets.sort((a, b) => b.score - a.score);

  // Return the top defaultNumFilesUsed (or all if fewer)
  return scoredSnippets
    .slice(0, Math.min(defaultNumFilesUsed, scoredSnippets.length))
    .map((item) => item.snippet);
};

// returns linear combination of recency and size scores
// recency score is exponential decay over recency; log normalized score is used for size
const getRecencyAndSizeScore = (
  index: number,
  snippet: AutocompleteSnippet,
): number => {
  const recencyScore = Math.pow(1.15, -1 * index);

  const logCurrent = Math.log(Math.max(snippet.content.length, minSize));
  const sizeScore =
    logMax === logMin ? 0.5 : 1 - (logCurrent - logMax) / (logMax - logMin);

  return recencyWeight * recencyScore + sizeWeight * sizeScore;
};

// Utility to set logMin and logMax
const setLogStats = (snippets: AutocompleteSnippet[]): void => {
  let contentSizes = snippets
    .slice(0, 10)
    .map((snippet) => snippet.content.length);
  logMin = Math.log(Math.max(Math.min(...contentSizes), minSize));
  logMax = Math.log(Math.max(Math.max(...contentSizes), minSize));
  return;
};

function trimSnippetForContext(
  snippet: AutocompleteSnippet,
  maxTokens: number,
  modelName: string,
): { newSnippet: AutocompleteSnippet; newTokens: number } {
  // If the code is already under the token limit, return it as is
  let numTokensInSnippet = countTokens(snippet.content, modelName);
  if (numTokensInSnippet <= maxTokens) {
    return { newSnippet: snippet, newTokens: numTokensInSnippet };
  }

  // Else trim from bottom
  let trimmedCode = pruneStringFromBottom(
    modelName,
    maxTokens,
    snippet.content,
  );

  // Add an indicator that the code has been trimmed
  if (trimmedCode !== snippet.content) {
    const lastNewline = trimmedCode.lastIndexOf("\n");
    if (lastNewline !== -1) {
      trimmedCode =
        trimmedCode.substring(0, lastNewline) + "\n// remaining code trimmed";
    }
  }

  return {
    newSnippet: { ...snippet, content: trimmedCode },
    newTokens: countTokens(trimmedCode, modelName),
  };
}
