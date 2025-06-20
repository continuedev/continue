import { countTokens, pruneStringFromBottom } from "../../llm/countTokens";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippet,
  AutocompleteSnippetType,
} from "../snippets/types";
import { HelperVars } from "../util/HelperVars";

let logMin: number;
let logMax: number;

const numFilesConsidered = 10;
const defaultNumFilesUsed = 5;
const recencyWeight = 0.6;
const sizeWeight = 0.4;
const minSize = 10;
const minTokensInSnippet = 125;

// Fits opened-file snippets into the remaining amount of prompt tokens
export function formatOpenedFilesContext(
  recentlyOpenedFilesSnippets: AutocompleteCodeSnippet[],
  remainingTokenCount: number,
  helper: HelperVars,
  alreadyAddedSnippets: AutocompleteSnippet[],
  TOKEN_BUFFER: number,
): AutocompleteCodeSnippet[] {
  if (recentlyOpenedFilesSnippets.length === 0) {
    return [];
  }

  // deduplication; if a snippet is already added, don't include it here
  for (const snippet of alreadyAddedSnippets) {
    if (snippet.type !== AutocompleteSnippetType.Code) {
      continue;
    }
    recentlyOpenedFilesSnippets = recentlyOpenedFilesSnippets.filter(
      (s) => s.filepath !== snippet.filepath,
    );
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

  // if all the untrimmed snippets, or more than a default value, fit, return the untrimmed snippets
  if (numSnippetsThatFit >= numFilesUsed) {
    return recentlyOpenedFilesSnippets.slice(0, numSnippetsThatFit);
  }

  // If they don't fit, adaptively trim them.
  setLogStats(recentlyOpenedFilesSnippets);
  const topScoredSnippets = rankByScore(recentlyOpenedFilesSnippets);
  let N = topScoredSnippets.length;
  while (remainingTokenCount - TOKEN_BUFFER < N * minTokensInSnippet) {
    topScoredSnippets.pop();
    N = topScoredSnippets.length;
    if (N === 0) break;
  }

  let trimmedSnippets = new Array<AutocompleteCodeSnippet>();

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
  snippets: AutocompleteCodeSnippet[],
): AutocompleteCodeSnippet[] => {
  if (snippets.length === 0) return [];

  const topSnippets = snippets.slice(0, numFilesConsidered);

  // Sort by score (using original index for recency calculation)
  const scoredSnippets = topSnippets.map((snippet, i) => ({
    snippet,
    originalIndex: i,
    score: getRecencyAndSizeScore(i, snippet),
  }));

  // Uncomment to debug. Logs the table of snippets with their scores (in order of recency).
  /* console.table(
    topSnippets.map((snippet, i) => ({
      filepath: "filepath" in snippet ? snippet.filepath : "unknown",
      recencyAndSizeScore: getRecencyAndSizeScore(i, snippet),
    })),
  ); */

  scoredSnippets.sort((a, b) => b.score - a.score);

  return scoredSnippets
    .slice(0, Math.min(defaultNumFilesUsed, scoredSnippets.length))
    .map((item) => item.snippet);
};

// Returns linear combination of recency and size scores
// recency score is exponential decay over recency; log normalized score is used for size
const getRecencyAndSizeScore = (
  index: number,
  snippet: AutocompleteSnippet,
): number => {
  const recencyScore = Math.pow(1.15, -1 * index);

  const logCurrent = Math.log(Math.max(snippet.content.length, minSize));
  const sizeScore =
    logMax === logMin ? 0.5 : 1 - (logCurrent - logMin) / (logMax - logMin);

  return recencyWeight * recencyScore + sizeWeight * sizeScore;
};

const setLogStats = (snippets: AutocompleteSnippet[]): void => {
  let contentSizes = snippets
    .slice(0, 10)
    .map((snippet) => snippet.content.length);
  logMin = Math.log(Math.max(Math.min(...contentSizes), minSize));
  logMax = Math.log(Math.max(Math.max(...contentSizes), minSize));
  return;
};

function trimSnippetForContext(
  snippet: AutocompleteCodeSnippet,
  maxTokens: number,
  modelName: string,
): { newSnippet: AutocompleteCodeSnippet; newTokens: number } {
  let numTokensInSnippet = countTokens(snippet.content, modelName);
  if (numTokensInSnippet <= maxTokens) {
    return { newSnippet: snippet, newTokens: numTokensInSnippet };
  }

  let trimmedCode = pruneStringFromBottom(
    modelName,
    maxTokens,
    snippet.content,
  );

  return {
    newSnippet: { ...snippet, content: trimmedCode },
    newTokens: countTokens(trimmedCode, modelName),
  };
}

// Uncomment for testing
export {
  getRecencyAndSizeScore,
  rankByScore,
  setLogStats,
  trimSnippetForContext,
};
