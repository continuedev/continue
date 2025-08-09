import {
  ContextProviderDescription,
  ContextProviderName,
  ContextSubmenuItemWithProvider,
} from "core";
import { deduplicateArray, splitCamelCaseAndNonAlphaNumeric } from "core/util";
import {
  getShortestUniqueRelativeUriPaths,
  getUriPathBasename,
} from "core/util/uri";
import MiniSearch, { SearchResult } from "minisearch";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppSelector } from "../redux/hooks";
import { selectSubmenuContextProviders } from "../redux/selectors";
import { IdeMessengerContext } from "./IdeMessenger";

const MINISEARCH_OPTIONS = {
  prefix: true,
  fuzzy: 2,
};

const MAX_LENGTH = 70;

// Enhanced search result interface for intelligent sorting
interface EnhancedSearchResult
  extends SearchResult,
    Omit<ContextSubmenuItemWithProvider, "id"> {
  sortPriority: number;
  matchQuality: number;
}

interface SubtextContextProvidersContextType {
  getSubmenuContextItems: (
    providerTitle: string | undefined,
    query: string,
  ) => ContextSubmenuItemWithProvider[];
}

const initialContextProviders: SubtextContextProvidersContextType = {
  getSubmenuContextItems: () => [],
};

const SubmenuContextProvidersContext =
  createContext<SubtextContextProvidersContextType>(initialContextProviders);

// Helper functions for intelligent file sorting
function hasExactWordMatch(text: string, query: string): boolean {
  const words = text.split(/[^a-zA-Z0-9]+/);
  return words.some((word) => word === query);
}

function isCommonDevFile(fileName: string): boolean {
  const commonExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".java",
    ".cpp",
    ".c",
    ".h",
    ".vue",
    ".svelte",
  ];
  const commonNames = [
    "index",
    "main",
    "app",
    "component",
    "service",
    "util",
    "helper",
    "config",
    "types",
  ];

  const extension = fileName.substring(fileName.lastIndexOf("."));
  const baseName = fileName
    .substring(0, fileName.lastIndexOf("."))
    .toLowerCase();

  return commonExtensions.includes(extension) || commonNames.includes(baseName);
}

function isInCommonDirectory(filePath: string): boolean {
  const commonDirs = [
    "src/",
    "lib/",
    "components/",
    "utils/",
    "helpers/",
    "services/",
    "pages/",
    "views/",
    "hooks/",
    "store/",
    "types/",
    "interfaces/",
    "models/",
    "api/",
  ];
  return commonDirs.some((dir) => filePath.includes(dir));
}

function matchesCamelCaseOrAbbreviation(
  fileName: string,
  query: string,
): boolean {
  // Extract capital letters for camel case matching
  const capitals = fileName.match(/[A-Z]/g)?.join("").toLowerCase() || "";

  // Check if query matches the capital letters pattern
  if (capitals.length > 0 && capitals.includes(query)) {
    return true;
  }

  // Check for abbreviation matches (first letters of words)
  const words = fileName.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0);
  if (words.length > 1) {
    const abbreviation = words
      .map((word) => word[0])
      .join("")
      .toLowerCase();
    return abbreviation.includes(query);
  }

  return false;
}

export const SubmenuContextProvidersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const ideMessenger = useContext(IdeMessengerContext);
  const submenuContextProviders = useAppSelector(selectSubmenuContextProviders);
  const lastProviders = useRef(submenuContextProviders);
  const disableIndexing = useAppSelector(
    (store) => store.config.config.disableIndexing,
  );

  const [minisearches, setMinisearches] = useState<{
    [id: string]: MiniSearch<ContextSubmenuItemWithProvider>;
  }>({});
  const [fallbackResults, setFallbackResults] = useState<{
    [id: string]: ContextSubmenuItemWithProvider[];
  }>({});

  // Update open files for file provider on an interval
  const lastOpenFilesRef = useRef<ContextSubmenuItemWithProvider[]>([]);
  useEffect(() => {
    function hasOpenFilesChanged(
      newFiles: ContextSubmenuItemWithProvider[],
      oldFiles: ContextSubmenuItemWithProvider[],
    ) {
      const newIds = new Set(newFiles.map((f) => f.id));
      const oldIds = new Set(oldFiles.map((f) => f.id));

      if (newIds.size !== oldIds.size) return true;

      for (const id of newIds) {
        if (!oldIds.has(id)) return true;
      }

      for (const id of oldIds) {
        if (!newIds.has(id)) return true;
      }
      return false;
    }

    let isMounted = true;
    const refreshOpenFiles = async () => {
      if (!isMounted) return;

      const openFiles = await ideMessenger.ide.getOpenFiles();
      const workspaceDirs = await ideMessenger.ide.getWorkspaceDirs();
      const withUniquePaths = getShortestUniqueRelativeUriPaths(
        openFiles,
        workspaceDirs,
      );
      const openFileItems = withUniquePaths.map((file) => ({
        id: file.uri,
        title: getUriPathBasename(file.uri),
        description: file.uniquePath,
        providerTitle: "file",
      }));

      if (hasOpenFilesChanged(openFileItems, lastOpenFilesRef.current)) {
        setFallbackResults((prev) => ({
          ...prev,
          file: deduplicateArray(
            [...openFileItems, ...(prev.file ?? [])],
            (a, b) => a.id === b.id,
          ),
        }));
      }
      lastOpenFilesRef.current = openFileItems;
    };

    const interval = setInterval(refreshOpenFiles, 2000);

    void refreshOpenFiles(); // Initial call

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [ideMessenger]);

  const providersLoading = useRef(new Set<ContextProviderName>()).current;
  const abortControllers = useRef(
    new Map<ContextProviderName, AbortController>(),
  ).current;

  const calculateFileSortPriority = useCallback(
    (
      result: SearchResult & ContextSubmenuItemWithProvider,
      query: string,
      openFiles: ContextSubmenuItemWithProvider[],
    ): number => {
      const fileName = result.title.toLowerCase();
      const filePath = result.description.toLowerCase();
      const queryLower = query.toLowerCase();

      // Priority 1: Exact filename match
      if (fileName === queryLower) {
        return 1;
      }

      // Priority 2: Recently opened files
      if (openFiles.some((f) => f.id === result.id)) {
        return 2;
      }

      // Priority 3: Filename starts with query
      if (fileName.startsWith(queryLower)) {
        return 3;
      }

      // Priority 4: Exact word match in filename
      if (hasExactWordMatch(fileName, queryLower)) {
        return 4;
      }

      // Priority 5: Common development files
      if (isCommonDevFile(fileName)) {
        return 5;
      }

      // Priority 6: Files in common directories
      if (isInCommonDirectory(filePath)) {
        return 6;
      }

      // Priority 7: CamelCase/abbreviation matches
      if (matchesCamelCaseOrAbbreviation(fileName, queryLower)) {
        return 7;
      }

      // Priority 8: Path starts with query
      if (filePath.startsWith(queryLower)) {
        return 8;
      }

      // Priority 9: Default
      return 9;
    },
    [],
  );

  const calculateMatchQuality = useCallback(
    (
      result: SearchResult & ContextSubmenuItemWithProvider,
      query: string,
    ): number => {
      const fileName = result.title.toLowerCase();
      const queryLower = query.toLowerCase();
      let quality = 0;

      // Exact match bonus
      if (fileName === queryLower) quality += 100;

      // Prefix match bonus
      if (fileName.startsWith(queryLower)) quality += 50;

      // Contains match bonus
      if (fileName.includes(queryLower)) quality += 25;

      // Shorter filename bonus (prefer concise names)
      quality += Math.max(0, 50 - fileName.length);

      // Extension preference (common dev files)
      if (
        fileName.endsWith(".ts") ||
        fileName.endsWith(".tsx") ||
        fileName.endsWith(".js") ||
        fileName.endsWith(".jsx")
      ) {
        quality += 10;
      }

      return quality;
    },
    [],
  );

  const getSubmenuContextItems = useCallback(
    (
      providerTitle: string | undefined,
      query: string,
      limit: number = MAX_LENGTH,
    ): ContextSubmenuItemWithProvider[] => {
      try {
        // 1. Search using minisearch
        let searchResults: (SearchResult & ContextSubmenuItemWithProvider)[] =
          [];

        if (providerTitle === undefined) {
          // Include results from all providers
          searchResults = Object.keys(minisearches).flatMap((providerTitle) =>
            minisearches[providerTitle]
              .search(query, MINISEARCH_OPTIONS)
              .map((result) => {
                return {
                  ...result,
                  providerTitle,
                  title: result.title,
                  description: result.description,
                };
              }),
          );
        } else {
          // Only include results from the specified provider
          if (minisearches[providerTitle]) {
            searchResults = minisearches[providerTitle]
              .search(query, MINISEARCH_OPTIONS)
              .map((result) => {
                return {
                  ...result,
                  providerTitle,
                  title: result.title,
                  description: result.description,
                };
              });
          }
        }

        // 2. Enhanced sorting for file provider
        if (
          providerTitle === "file" ||
          (!providerTitle &&
            searchResults.some((r) => r.providerTitle === "file"))
        ) {
          const enhancedResults: EnhancedSearchResult[] = searchResults.map(
            (result): EnhancedSearchResult => ({
              ...result,
              id: result.id,
              title: result.title,
              description: result.description,
              providerTitle: result.providerTitle,
              sortPriority: calculateFileSortPriority(
                result,
                query,
                lastOpenFilesRef.current,
              ),
              matchQuality: calculateMatchQuality(result, query),
            }),
          );

          // Sort by multiple criteria
          enhancedResults.sort((a, b) => {
            // Primary: Sort priority (lower = better)
            if (a.sortPriority !== b.sortPriority) {
              return a.sortPriority - b.sortPriority;
            }

            // Secondary: Match quality (higher = better)
            if (a.matchQuality !== b.matchQuality) {
              return b.matchQuality - a.matchQuality;
            }

            // Tertiary: MiniSearch relevance score (higher = better)
            if (a.score !== b.score) {
              return b.score - a.score;
            }

            // Quaternary: Path length (shorter = better)
            return a.description.length - b.description.length;
          });

          searchResults = enhancedResults;
        } else {
          // Default sorting for non-file providers
          searchResults.sort((a, b) => b.score - a.score);
        }

        // 3. Add fallback results if no search results
        if (searchResults.length === 0) {
          const fallbackItems = (
            providerTitle ? (fallbackResults[providerTitle] ?? []) : []
          )
            .slice(0, limit)
            .map((result) => {
              return {
                ...result,
                providerTitle: providerTitle || "unknown",
              };
            });

          if (fallbackItems.length === 0) {
            const loadingFiller = [
              {
                id: "loading",
                title: "Loading...",
                description: "Please wait while items are being loaded",
                providerTitle: providerTitle || "unknown",
              },
            ];

            // If getting for all providers
            if (!providerTitle) {
              // then show loading if ANY loading
              if (providersLoading.size > 0) {
                return loadingFiller;
              }
            } else {
              // Otherwise just check if the provider is loading
              if (providersLoading.has(providerTitle)) {
                return loadingFiller;
              }
            }
          }

          return fallbackItems;
        }
        const limitedResults = searchResults.slice(0, limit).map((result) => {
          return {
            id: result.id,
            title: result.title,
            description: result.description,
            providerTitle: result.providerTitle,
          };
        });
        return limitedResults;
      } catch (error) {
        console.error("Error in getSubmenuContextItems:", error);
        return [];
      }
    },
    [
      fallbackResults,
      minisearches,
      calculateFileSortPriority,
      calculateMatchQuality,
    ],
  );

  const loadSubmenuItems = useCallback(
    async (providers: "dependsOnIndexing" | "all" | ContextProviderName[]) => {
      await Promise.allSettled(
        submenuContextProviders.map(
          async (description: ContextProviderDescription) => {
            const controller = new AbortController();
            try {
              const refreshProvider =
                providers === "all"
                  ? true
                  : providers === "dependsOnIndexing"
                    ? description.dependsOnIndexing &&
                      description.dependsOnIndexing?.length > 0
                    : providers.includes(description.title);

              if (!refreshProvider) {
                if (providers === "dependsOnIndexing") {
                  console.debug(
                    `Skipping ${description.title} provider due to disabled indexing`,
                  );
                }
                return;
              }

              // Submenu loading requests cancel existing requests
              abortControllers.get(description.title)?.abort();
              abortControllers.set(description.title, controller);
              providersLoading.add(description.title);

              const result = await ideMessenger.request(
                "context/loadSubmenuItems",
                {
                  title: description.title,
                },
              );

              // IMPORTANT - the controller only prevents invalid loading state
              // But does not cancel using data from the request
              // Could uncomment this to truly cancel the request
              // if (controller.signal.aborted) {
              //   return console.debug(
              //     `${description.title} provider loading aborted`,
              //   );
              // }

              if (result.status === "error") {
                throw new Error(result.error);
              }
              const submenuItems = result.content;
              const providerTitle = description.title;
              const renderInlineAs = description.renderInlineAs;

              const itemsWithProvider = submenuItems.map((item) => ({
                ...item,
                providerTitle,
                renderInlineAs,
              }));

              const minisearch = new MiniSearch<ContextSubmenuItemWithProvider>(
                {
                  fields: ["title", "description"],
                  storeFields: ["id", "title", "description", "providerTitle"],
                  tokenize: (text) =>
                    deduplicateArray(
                      MiniSearch.getDefault("tokenize")(text).concat(
                        splitCamelCaseAndNonAlphaNumeric(text),
                      ),
                      (a, b) => a === b,
                    ),
                },
              );

              const deduplicatedItems = deduplicateArray(
                submenuItems.map((item) => ({ ...item, providerTitle })),
                (a, b) => a.id === b.id,
              );
              minisearch.addAll(deduplicatedItems);

              setMinisearches((prev) => ({
                ...prev,
                [providerTitle]: minisearch,
              }));

              if (providerTitle === "file") {
                setFallbackResults((prev) => ({
                  ...prev,
                  file: deduplicateArray(
                    [...lastOpenFilesRef.current, ...itemsWithProvider],
                    (a, b) => a.id === b.id,
                  ),
                }));
              } else {
                setFallbackResults((prev) => ({
                  ...prev,
                  [providerTitle]: itemsWithProvider,
                }));
              }
            } catch (error) {
              console.error(
                `Error loading items for ${description.title}:`,
                error,
              );
              console.error(
                "Error details:",
                JSON.stringify(error, Object.getOwnPropertyNames(error)),
              );
            } finally {
              if (!controller.signal.aborted) {
                providersLoading.delete(description.title);
              }
            }
          },
        ),
      );
    },
    [
      submenuContextProviders,
      disableIndexing,
      providersLoading,
      abortControllers,
    ],
  );

  useWebviewListener(
    "refreshSubmenuItems",
    async (data) => {
      void loadSubmenuItems(data.providers);
    },
    [loadSubmenuItems],
  );

  // Reload all submenu items on the initial config load
  useEffect(() => {
    if (!submenuContextProviders.length) {
      return;
    }
    // Refresh submenu items when new titles detected
    const newTitles = submenuContextProviders
      .filter(
        (provider) =>
          !lastProviders.current.find((p) => p.title === provider.title),
      )
      .map((provider) => provider.title);
    if (newTitles.length > 0) {
      void loadSubmenuItems(newTitles);
    }
    lastProviders.current = submenuContextProviders;
  }, [loadSubmenuItems, submenuContextProviders]);

  return (
    <SubmenuContextProvidersContext.Provider
      value={{
        getSubmenuContextItems,
      }}
    >
      {children}
    </SubmenuContextProvidersContext.Provider>
  );
};

export const useSubmenuContextProviders = () =>
  useContext(SubmenuContextProvidersContext);
