import { ContextItem } from "../llm/types";

// TODO:

export async function getContextItem(id: string, query: string) {
  const item: ContextItem = {
    id: {
      providerTitle: "TODO",
      itemId: id,
    },
    name: "TODO",
    description: "TODO",
    content: query,
  };
  return item;
}
