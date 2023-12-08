import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { ContextProviderName } from "core/config";
import { ContextProvider, ContextProviderDescription } from "core/context";
import Providers from "core/context/providers";
import { ContextItem } from "core/llm/types";

function providerNameToProvider(
  name: ContextProviderName
): typeof ContextProvider {
  const cls = Providers[name];

  if (!cls) {
    throw new Error(`Unknown provider ${name}`);
  }

  return cls;
}

function useContextProviders() {
  const [providers, setProviders] = useState<{
    [name: string]: ContextProvider;
  }>({});
  const [providerDescriptions, setProviderDescriptions] = useState<
    ContextProviderDescription[]
  >([]);

  const providerConfig = useSelector(
    (store: RootStore) => store.state.config.contextProviders
  );

  useEffect(() => {
    let providersList = [];
    let descriptionsList = [];
    for (const [name, options] of Object.entries(providerConfig)) {
      const provider = providerNameToProvider(name as ContextProviderName);
      providersList.push((provider as any)(options));
      descriptionsList.push(provider.description);
    }

    setProviders(providers);
    setProviderDescriptions(descriptionsList);
  }, [providerConfig]);

  async function getContextItems(
    name: string,
    query: string
  ): Promise<ContextItem[]> {
    const provider = providers[name];
    if (!provider) {
      throw new Error(`Unknown provider ${name}`);
    }
    return await provider.getContextItems(query);
  }

  return { providerDescriptions, getContextItems };
}

export default useContextProviders;
