import Handlebars from "handlebars";
import { ContextItem, ContinueSDK, IContextProvider } from "../..";

function createContextItem(item: ContextItem, provider: IContextProvider) {
  return {
    ...item,
    id: {
      itemId: item.description,
      providerTitle: provider.description.title,
    },
  };
}

export function getContextProviderHelpers(
  context: ContinueSDK,
): Array<[string, Handlebars.HelperDelegate]> | undefined {
  return context.config.contextProviders?.map((provider: IContextProvider) => [
    provider.description.title,
    async (helperContext: any) => {
      const items = await provider.getContextItems(helperContext, {
        config: context.config,
        embeddingsProvider: context.config.selectedModelByRole.embed,
        fetch: context.fetch,
        fullInput: context.input,
        ide: context.ide,
        llm: context.llm,
        reranker: context.config.selectedModelByRole.rerank,
        selectedCode: context.selectedCode,
      });

      items.forEach((item) =>
        context.addContextItem(createContextItem(item, provider)),
      );

      return items.map((item) => item.content).join("\n\n");
    },
  ]);
}
