import { ContextItem } from "core/llm/types";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { errorPopup } from "../util/ide";

function useContextProviders() {
  const contextProviders = useSelector(
    (state: RootStore) => state.state.config.contextProviders || []
  );

  async function getContextItems(
    name: string,
    query: string
  ): Promise<ContextItem[]> {
    const provider = contextProviders.find((p) => p.description.title === name);
    if (!provider) {
      errorPopup(`Unknown provider ${name}`);
    }
    try {
      return await provider.getContextItems(query);
    } catch (e) {
      errorPopup(`Error getting context items from ${name}: ${e.message}`);
      return [];
    }
  }

  return { getContextItems };
}

export default useContextProviders;
