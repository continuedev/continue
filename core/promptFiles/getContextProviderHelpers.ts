import Handlebars from "handlebars";

export function getContextProviderHelpers(
  context: any,
): Array<[string, Handlebars.HelperDelegate]> | undefined {
  return context.config.contextProviders?.map((provider: any) => [
    provider.description.title,
    async (helperContext: any) => {
      const items = await provider.getContextItems(helperContext, {
        config: context.config,
        embeddingsProvider: context.config.embeddingsProvider,
        fetch: context.fetch,
        fullInput: context.input,
        ide: context.ide,
        llm: context.llm,
        reranker: context.config.reranker,
        selectedCode: context.selectedCode,
      });

      items.forEach((item: any) =>
        context.addContextItem(createContextItem(item, provider)),
      );

      return items.map((item: any) => item.content).join("\n\n");
    },
  ]);
}

function createContextItem(item: any, provider: any) {
  return {
    ...item,
    id: {
      itemId: item.description,
      providerTitle: provider.description.title,
    },
  };
}
