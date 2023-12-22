import { ContextItemId, ContextItemWithId, IContextProvider } from "core";
import { useSelector } from "react-redux";
import { v4 } from "uuid";
import { RootStore } from "../redux/store";
import { errorPopup } from "../util/ide";

export async function getContextItems(
  contextProviders: IContextProvider[],
  name: string,
  query: string
): Promise<ContextItemWithId[]> {
  const provider = contextProviders.find((p) => p.description.title === name);
  if (!provider) {
    errorPopup(
      `Unknown provider ${name}. Existing providers: ${contextProviders
        .map((p) => p.description.title)
        .join(", ")}`
    );
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
function useContextProviders() {
  const contextProviders = useSelector(
    (state: RootStore) => state.state.config.contextProviders || []
  );

  return {
    getContextItems: (name, query) =>
      getContextItems(contextProviders, name, query),
  };
}

export default useContextProviders;
