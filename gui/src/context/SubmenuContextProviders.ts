import { ContextSubmenuItem } from "core";
import { createContext } from "react";

export const SubmenuContextProvidersContext = createContext<{
  getSubmenuContextItems: (
    providerTitle: string | undefined,
    query: string,
  ) => (ContextSubmenuItem & { providerTitle: string })[];
  addItem: (providerTitle: string, item: ContextSubmenuItem) => void;
}>({
  getSubmenuContextItems: () => [],
  addItem: () => {},
});
