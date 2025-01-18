import {
  ContextProviderDescription,
  ContextProviderName,
  ContextSubmenuItemWithProvider,
} from "core";
import { createContext } from "react";
import { deduplicateArray } from "core/util";
import MiniSearch, { SearchResult } from "minisearch";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "./IdeMessenger";
import { selectSubmenuContextProviders } from "../redux/selectors";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppSelector } from "../redux/hooks";
import {
  getShortestUniqueRelativeUriPaths,
  getUriPathBasename,
} from "core/util/uri";

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

  const providersLoading = useRef(new Set<string>()).current;

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
    (providers: "dependsOnIndexing" | "all" | ContextProviderName[]) => {
      submenuContextProviders.forEach(
        async (description: ContextProviderDescription) => {
          try {
            if (providersLoading.has(description.title)) {
              return;
            }
            providersLoading.add(description.title);

            const refreshProvider =
              providers === "all"
                ? true
                : providers === "dependsOnIndexing"
                  ? description.dependsOnIndexing
                  : providers.includes(description.title);

            if (!refreshProvider) {
              return;
            }

            if (description.dependsOnIndexing && disableIndexing) {
              console.debug(
                `Skipping ${description.title} provider due to disabled indexing`,
              );
              return;
            }
            const result = await ideMessenger.request(
              "context/loadSubmenuItems",
              {
                title: description.title,
              },
            );

            if (result.status === "error") {
              throw new Error(result.error);
            }
            const submenuItems = result.content;
            const providerTitle = description.title;

            const itemsWithProvider = submenuItems.map((item) => ({
              ...item,
              providerTitle,
            }));

            const minisearch = new MiniSearch<ContextSubmenuItemWithProvider>({
              fields: ["title", "description"],
              storeFields: ["id", "title", "description", "providerTitle"],
            });

            minisearch.addAll(
              submenuItems.map((item) => ({ ...item, providerTitle })),
            );

            setMinisearches((prev) => ({
              ...prev,
              [providerTitle]: minisearch,
            }));

            if (providerTitle === "file") {
              setFallbackResults((prev) => ({
                ...prev,
                file: deduplicateArray(
                  [...lastOpenFilesRef.current, ...(prev.file ?? [])],
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
            providersLoading.delete(description.title);
          }
        },
      );
    },
    [submenuContextProviders, disableIndexing, providersLoading],
  );

  useWebviewListener(
    "refreshSubmenuItems",
    async (data) => {
      await loadSubmenuItems(data.providers);
    },
    [loadSubmenuItems],
  );

  useEffect(() => {
    void loadSubmenuItems("all");
  }, [loadSubmenuItems]);

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
