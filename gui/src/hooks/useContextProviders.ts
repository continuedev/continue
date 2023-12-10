import { ContextItem } from "core/llm/types";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

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
      throw new Error(`Unknown provider ${name}`);
    }
    return await provider.getContextItems(query);
  }

  return { getContextItems };
}

export default useContextProviders;
