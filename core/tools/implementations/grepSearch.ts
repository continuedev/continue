import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { formatGrepSearchResults } from "../../util/grepSearch";
import { prepareQueryForRipgrep } from "../../util/regexValidator";
import { getStringArg } from "../parseArgs";

const DEFAULT_GREP_SEARCH_RESULTS_LIMIT = 100;
const DEFAULT_GREP_SEARCH_CHAR_LIMIT = 7500; // ~1500 tokens, will keep truncation simply for now

type GrepOutputMode = "content" | "files_with_matches" | "count";

function getOptionalNumberArg(args: any, names: string[]): number | undefined {
  for (const name of names) {
    const value = args?.[name];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return undefined;
}

function getOutputMode(args: any): GrepOutputMode {
  const value =
    typeof args?.outputMode === "string"
      ? args.outputMode.trim().toLowerCase()
      : typeof args?.output_mode === "string"
        ? args.output_mode.trim().toLowerCase()
        : "content";

  if (value === "files_with_matches" || value === "count") {
    return value;
  }

  return "content";
}

function getQueryArg(args: any): string {
  if (typeof args?.query === "string") {
    return args.query;
  }

  // Compatibility alias for CLI-style grep args.
  if (typeof args?.pattern === "string") {
    return args.pattern;
  }

  return getStringArg(args, "query");
}

function paginateLines(
  content: string,
  limit: number | undefined,
  offset: number | undefined,
): string {
  const lines = content.split("\n").filter(Boolean);
  const start = Math.max(0, offset ?? 0);

  if (start >= lines.length) {
    return "";
  }

  if (limit === 0) {
    return lines.slice(start).join("\n");
  }

  if (typeof limit === "number" && limit > 0) {
    return lines.slice(start, start + limit).join("\n");
  }

  return lines.slice(start).join("\n");
}

function parseResultBlocks(
  content: string,
): Array<{ filepath: string; lines: string[] }> {
  const blocks: Array<{ filepath: string; lines: string[] }> = [];
  let currentFile: string | undefined;
  let currentLines: string[] = [];

  for (const line of content.split("\n")) {
    const headingMatch = line.match(/^\.\/([^\n]+)$/);
    if (headingMatch) {
      if (currentFile) {
        blocks.push({ filepath: currentFile, lines: currentLines });
      }
      currentFile = headingMatch[1];
      currentLines = [];
      continue;
    }

    if (currentFile) {
      currentLines.push(line);
    }
  }

  if (currentFile) {
    blocks.push({ filepath: currentFile, lines: currentLines });
  }

  return blocks;
}

function splitGrepResultsByFile(content: string): ContextItem[] {
  const matches = [...content.matchAll(/^\.\/([^\n]+)$/gm)];

  const contextItems: ContextItem[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filepath = match[1];
    const startIndex = match.index!;
    const endIndex =
      i < matches.length - 1 ? matches[i + 1].index! : content.length;

    // Extract grepped content for this file
    const fileContent = content
      .substring(startIndex, endIndex)
      .replace(/^\.\/[^\n]+\n/, "") // remove the line with file path
      .trim();

    if (fileContent) {
      contextItems.push({
        name: `Search results in ${filepath}`,
        description: `Grep search results from ${filepath}`,
        content: fileContent,
        uri: { type: "file", value: filepath },
      });
    }
  }

  return contextItems;
}

export const grepSearchImpl: ToolImpl = async (args, extras) => {
  const rawQuery = getQueryArg(args);
  const includePattern =
    typeof args?.includePattern === "string"
      ? args.includePattern
      : typeof args?.glob === "string"
        ? args.glob
        : undefined;
  const maxResults =
    typeof args?.maxResults === "number"
      ? args.maxResults
      : typeof args?.max_results === "number"
        ? args.max_results
        : DEFAULT_GREP_SEARCH_RESULTS_LIMIT;
  const outputMode = getOutputMode(args);
  const caseSensitive =
    typeof args?.caseSensitive === "boolean"
      ? args.caseSensitive
      : typeof args?.case_insensitive === "boolean"
        ? !args.case_insensitive
        : false;
  const requestedContextLines =
    getOptionalNumberArg(args, ["contextLines", "context"]) ?? 2;
  const contextLines = outputMode === "content" ? requestedContextLines : 0;
  const multiline = args?.multiline === true;
  const headLimit = getOptionalNumberArg(args, ["headLimit", "head_limit"]);
  const offset = getOptionalNumberArg(args, ["offset"]);

  const { query, warning } = prepareQueryForRipgrep(rawQuery);

  let results: string;
  try {
    results = await extras.ide.getSearchResults(query, {
      maxResults,
      includePattern,
      caseSensitive,
      contextLines,
      multiline,
      outputMode,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Helpful error for common ripgrep exit code
    if (errorMessage.includes("Process exited with code 2")) {
      return [
        {
          name: "Search error",
          description: "The search query could not be processed",
          content: `The search failed due to an invalid regex pattern.\n\nOriginal query: ${rawQuery}\nProcessed query: ${query}\n\nError: ${errorMessage}\n\nTip: If you're searching for literal text with special characters, the query was automatically escaped. If you need regex patterns, ensure they use proper regex syntax.`,
        },
      ];
    }

    throw new ContinueError(
      ContinueErrorReason.SearchExecutionFailed,
      errorMessage,
    );
  }

  if (outputMode === "files_with_matches") {
    const directPathLines = results
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const headingPaths = parseResultBlocks(results).map(
      (block) => block.filepath,
    );
    const uniquePaths = Array.from(
      new Set([...directPathLines, ...headingPaths]),
    );

    if (uniquePaths.length === 0) {
      return [
        {
          name: "Search results",
          description: "Files with matches from grep search",
          content: "The search returned no results.",
        },
      ];
    }

    const paginated = paginateLines(uniquePaths.join("\n"), headLimit, offset);

    return [
      {
        name: "Search results",
        description: "Files with matches from grep search",
        content:
          paginated ||
          "The search matched files, but none were left after applying pagination.",
      },
    ];
  }

  if (outputMode === "count") {
    const directCountLines = results
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^.+:\d+$/.test(line));

    const fallbackCountLines = parseResultBlocks(results)
      .map(({ filepath, lines }) => {
        const count = lines.filter(
          (line) => line.trim().length > 0 && line.trim() !== "--",
        ).length;
        return count > 0 ? `${filepath}:${count}` : undefined;
      })
      .filter((line): line is string => typeof line === "string");

    const countLines = directCountLines.length
      ? directCountLines
      : fallbackCountLines;

    if (countLines.length === 0) {
      return [
        {
          name: "Search results",
          description: "Match counts from grep search",
          content: "The search returned no results.",
        },
      ];
    }

    const paginated = paginateLines(countLines.join("\n"), headLimit, offset);

    return [
      {
        name: "Search results",
        description: "Match counts from grep search",
        content:
          paginated ||
          "The search found matches, but none were left after applying pagination.",
      },
    ];
  }

  const { formatted, numResults, truncated } = formatGrepSearchResults(
    results,
    DEFAULT_GREP_SEARCH_CHAR_LIMIT,
  );

  if (numResults === 0) {
    return [
      {
        name: "Search results",
        description: "Results from grep search",
        content: "The search returned no results.",
      },
    ];
  }

  const truncationReasons: string[] = [];
  if (numResults === maxResults) {
    truncationReasons.push(`the number of results exceeded ${maxResults}`);
  }
  if (truncated) {
    truncationReasons.push(
      `the number of characters exceeded ${DEFAULT_GREP_SEARCH_CHAR_LIMIT}`,
    );
  }

  let contextItems: ContextItem[];

  const splitByFile: boolean = args?.splitByFile || false;
  if (splitByFile) {
    contextItems = splitGrepResultsByFile(formatted);
  } else {
    const paginated = paginateLines(formatted, headLimit, offset);
    contextItems = [
      {
        name: "Search results",
        description: "Results from grep search",
        content:
          paginated ||
          "The search matched results, but none were left after applying pagination.",
      },
    ];
  }

  // Add warnings about query modifications or truncation.
  if (warning) {
    contextItems.push({
      name: "Search warning",
      description: "Query preprocessing",
      content: warning,
    });
  }

  if (truncationReasons.length > 0) {
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: `The above search results were truncated because ${truncationReasons.join(" and ")}. If the results are not satisfactory, try refining your search query.`,
    });
  }
  return contextItems;
};
