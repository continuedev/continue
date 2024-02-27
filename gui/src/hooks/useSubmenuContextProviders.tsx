import { ContextSubmenuItem } from "core";
import { getBasename, getLastNPathParts } from "core/util";
import MiniSearch, { SearchResult } from "minisearch";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectContextProviderDescriptions } from "../redux/selectors";
import { ideRequest } from "../util/ide";
import { WebviewIde } from "../util/webviewIde";
import { useWebviewListener } from "./useWebviewListener";

const MINISEARCH_OPTIONS = {
  prefix: true,
  fuzzy: 2,
};

function useSubmenuContextProviders() {
  // TODO: Refresh periodically

  const [minisearches, setMinisearches] = useState<{
    [id: string]: MiniSearch;
  }>({});
  const [fallbackResults, setFallbackResults] = useState<{
    [id: string]: ContextSubmenuItem[];
  }>({});

  const contextProviderDescriptions = useSelector(
    selectContextProviderDescriptions
  );

  const [loaded, setLoaded] = useState(false);

  async function getOpenFileItems() {
    const openFiles = await new WebviewIde().getOpenFiles();
    return openFiles.map((file) => {
      return {
        id: file,
        title: getBasename(file),
        description: getLastNPathParts(file, 2),
        providerTitle: "file",
      };
    });
  }

  useWebviewListener("refreshSubmenuItems", async (data) => {
    setLoaded(true);
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
      setFallbackResults((prev) => ({ ...prev, file: openFiles }));
    }, 2_000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (contextProviderDescriptions.length === 0 || loaded) {
      return;
    }
    setLoaded(true);
    contextProviderDescriptions.forEach(async (description) => {
      const minisearch = new MiniSearch<ContextSubmenuItem>({
        fields: ["title", "description"],
        storeFields: ["id", "title", "description"],
      });
      const items = await ideRequest("context/loadSubmenuItems", {
        title: description.title,
      });
      minisearch.addAll(items);
      setMinisearches((prev) => ({ ...prev, [description.title]: minisearch }));

      if (description.title === "file") {
        const openFiles = await getOpenFileItems();
        setFallbackResults((prev) => ({ ...prev, file: openFiles }));
      } else {
        setFallbackResults((prev) => ({
          ...prev,
          [description.title]: items.slice(0, 6),
        }));
      }
    });
  }, [contextProviderDescriptions, loaded]);

  function getSubmenuSearchResults(
    providerTitle: string | undefined,
    query: string
  ): SearchResult[] {
    if (providerTitle === undefined) {
      // Return search combined from all providers
      const results = Object.keys(minisearches).map((providerTitle) => {
        const results = minisearches[providerTitle].search(
          query,
          MINISEARCH_OPTIONS
        );
        return results.map((result) => {
          return { ...result, providerTitle };
        });
      });

      return results.flat().sort((a, b) => b.score - a.score);
    }
    if (!minisearches[providerTitle]) {
      return [];
    }

    return minisearches[providerTitle]
      .search(query, MINISEARCH_OPTIONS)
      .map((result) => {
        return { ...result, providerTitle };
      });
  }

  function getSubmenuContextItems(
    providerTitle: string | undefined,
    query: string,
    limit: number = 10
  ): (ContextSubmenuItem & { providerTitle: string })[] {
    const results = getSubmenuSearchResults(providerTitle, query);
    if (results.length === 0) {
      return (fallbackResults[providerTitle] ?? [])
        .slice(0, limit)
        .map((result) => {
          return {
            ...result,
            providerTitle,
          };
        });
    }
    return results.slice(0, limit).map((result) => {
      return {
        id: result.id,
        title: result.title,
        description: result.description,
        providerTitle: result.providerTitle,
      };
    });
  }

  return {
    getSubmenuContextItems,
    addItem,
  };
}

export default useSubmenuContextProviders;
