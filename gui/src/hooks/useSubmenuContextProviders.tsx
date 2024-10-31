import { ContextSubmenuItem } from "core";
import {
  deduplicateArray,
  getBasename,
  getUniqueFilePath,
  groupByLastNPathParts,
} from "core/util";
import MiniSearch, { SearchResult } from "minisearch";
import { useContext, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { selectContextProviderDescriptions } from "../redux/selectors";
import { useWebviewListener } from "./useWebviewListener";
import { store } from '../redux/store';
import { shouldSkipContextProviders } from "../integrations/util/integrationSpecificContextProviders";
import { defaultModelSelector } from "@/redux/selectors/modelSelectors";

const MINISEARCH_OPTIONS = {
  prefix: true,
  fuzzy: 2,
};

const MAX_LENGTH = 70;

function useSubmenuContextProviders() {
  const defaultModel = useSelector(defaultModelSelector);
  const [minisearches, setMinisearches] = useState<{
    [id: string]: MiniSearch;
  }>({});
  const [fallbackResults, setFallbackResults] = useState<{
    [id: string]: ContextSubmenuItem[];
  }>({});

  const contextProviderDescriptions = useSelector(
    selectContextProviderDescriptions,
  );

  const [loaded, setLoaded] = useState(false);
  const [lastDefaultModelTitle, setLastDefaultModelTitle] = useState<string | undefined>(undefined);

  const ideMessenger = useContext(IdeMessengerContext);

  async function getOpenFileItems() {
    const openFiles = await ideMessenger.ide.getOpenFiles();
    const openFileGroups = groupByLastNPathParts(openFiles, 2);

    return openFiles.map((file) => {
      return {
        id: file,
        title: getBasename(file),
        description: getUniqueFilePath(file, openFileGroups),
        providerTitle: "file",
      };
    });
  }

  useWebviewListener("refreshSubmenuItems", async (data) => {
    setLoaded(false);
  });

  useWebviewListener("updateSubmenuItems", async (data) => {
    const minisearch = new MiniSearch<ContextSubmenuItem>({
      fields: ["title", "description"],
      storeFields: ["id", "title", "description"],
    });

    minisearch.addAll(data.submenuItems);

    setMinisearches((prev) => ({ ...prev, [data.provider]: minisearch }));

    if (data.provider === "file") {
      const openFiles = await getOpenFileItems();
      setFallbackResults((prev) => ({
        ...prev,
        file: [
          ...openFiles,
          ...data.submenuItems.slice(0, MAX_LENGTH - openFiles.length),
        ],
      }));
    } else {
      setFallbackResults((prev) => ({
        ...prev,
        [data.provider]: data.submenuItems.slice(0, MAX_LENGTH),
      }));
    }
  });

  function addItem(providerTitle: string, item: ContextSubmenuItem) {
    if (!minisearches[providerTitle]) {
      return;
    }
    minisearches[providerTitle].add(item);
  }

  useEffect(() => {
    // Refresh open files periodically
    const interval = setInterval(async () => {
      const openFiles = await getOpenFileItems();
      setFallbackResults((prev) => ({
        ...prev,
        file: deduplicateArray(
          [...openFiles, ...(Array.isArray(prev.file) ? prev.file : [])],
          (a, b) => a.id === b.id,
        ),
      }));
    }, 2_000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const getSubmenuSearchResults = useMemo(
    () =>
      (providerTitle: string | undefined, query: string): SearchResult[] => {
        console.debug(
          "Executing getSubmenuSearchResults. Provider:",
          providerTitle,
          "Query:",
          query,
        );
        console.debug("Current minisearches:", Object.keys(minisearches));
        if (providerTitle === undefined) {
          // Return search combined from all providers
          const results = Object.keys(minisearches).map((providerTitle) => {
            const results = minisearches[providerTitle].search(
              query,
              MINISEARCH_OPTIONS,
            );
            console.debug(
              `Search results for ${providerTitle}:`,
              results.length,
            );
            return results.map((result) => {
              return { ...result, providerTitle };
            });
          });

          return results.flat().sort((a, b) => b.score - a.score);
        }
        if (!minisearches[providerTitle]) {
          console.debug(`No minisearch found for provider: ${providerTitle}`);
          return [];
        }

        const results = minisearches[providerTitle]
          .search(query, MINISEARCH_OPTIONS)
          .map((result) => {
            return { ...result, providerTitle };
          });
        console.debug(`Search results for ${providerTitle}:`, results.length);

        return results;
      },
    [minisearches],
  );

  const getSubmenuContextItems = useMemo(
    () =>
      (
        providerTitle: string | undefined,
        query: string,
        limit: number = MAX_LENGTH,
      ): (ContextSubmenuItem & { providerTitle: string })[] => {
        console.debug(
          "Executing getSubmenuContextItems. Provider:",
          providerTitle,
          "Query:",
          query,
          "Limit:",
          limit,
        );

        const results = getSubmenuSearchResults(providerTitle, query);
        if (results.length === 0) {
          const fallbackItems = (fallbackResults[providerTitle] ?? [])
            .slice(0, limit)
            .map((result) => {
              return {
                ...result,
                providerTitle,
              };
            });
          console.debug("Using fallback results:", fallbackItems.length);
          return fallbackItems;
        }
        const limitedResults = results.slice(0, limit).map((result) => {
          return {
            id: result.id,
            title: result.title,
            description: result.description,
            providerTitle: result.providerTitle,
          };
        });
        return limitedResults;
      },
    [fallbackResults, getSubmenuSearchResults],
  );

useEffect(() => {
  if ((contextProviderDescriptions.length === 0 || loaded) && defaultModel?.title === lastDefaultModelTitle) {
    return;
  }
  setMinisearches({});
  setFallbackResults({});
  setLoaded(true);
  setLastDefaultModelTitle(defaultModel?.title);

  contextProviderDescriptions.forEach(async (description) => {
    // Check if we should use relative file paths by checking the default model title
    if (shouldSkipContextProviders(defaultModel.title, description))
      return;

    const minisearch = new MiniSearch<ContextSubmenuItem>({
      fields: ["title", "description"],
      storeFields: ["id", "title", "description"],
    });
    const items = await ideMessenger.request("context/loadSubmenuItems", {
      title: description.title,
    });
    minisearch.addAll(items);
    setMinisearches((prev) => ({ ...prev, [description.title]: minisearch }));

    if (description.title === "file") {
      const openFiles = await getOpenFileItems();
      setFallbackResults((prev) => ({
        ...prev,
        file: [
          ...openFiles,
          ...items.slice(0, MAX_LENGTH - openFiles.length),
        ],
      }));
    } else {
      setFallbackResults((prev) => ({
        ...prev,
        [description.title]: items.slice(0, MAX_LENGTH),
      }));
    }
  });
}, [contextProviderDescriptions, loaded, defaultModel]);

  useWebviewListener("configUpdate", async () => {
    // When config is updated (for example switching to a different workspace)
    // we need to reload the context providers.
    setLoaded(false);
  });

  return {
    getSubmenuContextItems,
    addItem,
  };
}

export default useSubmenuContextProviders;
