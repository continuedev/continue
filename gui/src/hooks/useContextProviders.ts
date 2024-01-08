import {
  ContextItemId,
  ContextItemWithId,
  ContextProviderExtras,
  IContextProvider,
} from "core";
import { v4 } from "uuid";
import { errorPopup } from "../util/ide";

export async function getContextItems(
  contextProviders: IContextProvider[],
  name: string,
  query: string,
  extras: ContextProviderExtras
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
    const items = await provider.getContextItems(query, extras);
    return items.map((item) => ({ ...item, id }));
  } catch (e) {
    errorPopup(`Error getting context items from ${name}: ${e.message}`);
    return [];
  }
}
