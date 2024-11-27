import { ContextSubmenuItem } from "core";
import { createContext } from "react";

export interface ContextSubmenuItemWithProvider extends ContextSubmenuItem {
  providerTitle: string;
}

export const SubmenuContextProvidersContext = createContext<{
  getSubmenuContextItems: (
    providerTitle: string | undefined,
    query: string,
  ) => ContextSubmenuItemWithProvider[];
  addItem: (providerTitle: string, item: ContextSubmenuItem) => void;
}>({
  getSubmenuContextItems: () => [],
  addItem: () => {},
});
