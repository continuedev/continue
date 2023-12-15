import { ContextItemId, ContextItemWithId } from "core";
import { useSelector } from "react-redux";
import { v4 } from "uuid";
import { RootStore } from "../redux/store";
import { errorPopup } from "../util/ide";

function useContextProviders() {
  const contextProviders = useSelector(
    (state: RootStore) => state.state.config.contextProviders || []
  );

  async function getContextItems(
    name: string,
    query: string
  ): Promise<ContextItemWithId[]> {
    const provider = contextProviders.find((p) => p.description.title === name);
    if (!provider) {
      errorPopup(`Unknown provider ${name}`);
    }
    try {
      const id: ContextItemId = {
        providerTitle: provider.description.title,
        itemId: v4(),
      };
      const items = await provider.getContextItems(query);
      return items.map((item) => ({ ...item, id }));
    } catch (e) {
      errorPopup(`Error getting context items from ${name}: ${e.message}`);
      return [];
    }
  }

  return { getContextItems };
}

export default useContextProviders;
