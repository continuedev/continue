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

    refreshOpenFiles(); // Initial call

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [ideMessenger]);

  const providersLoading = useRef(new Set<ContextProviderName>()).current;
  const abortControllers = useRef(
    new Map<ContextProviderName, AbortController>(),
  ).current;

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
        searchResults.sort((a, b) => b.score - a.score);

        // 2. Add fallback results if no search results
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
    [fallbackResults, minisearches],
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
                    ? description.dependsOnIndexing
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
      loadSubmenuItems(data.providers);
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
      loadSubmenuItems(newTitles);
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
