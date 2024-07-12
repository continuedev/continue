import { ContinueConfig, IDE } from "core";
import { QuickPickItem, window } from "vscode";
import { fetchwithRequestOptions } from "core/util/fetchWithOptions";

export async function getContextProviderItems({
  contextProviders,
}: ContinueConfig): Promise<QuickPickItem[]> {
  if (!contextProviders) {
    return [];
  }

  const quickPickItems = contextProviders
    .filter((provider) => provider.description.type === "normal")
    .map((provider) => {
      return {
        label: provider.description.displayTitle,
        detail: provider.description.description,
      };
    });

  return quickPickItems;
}

export async function getContextProvidersString(
  selectedProviders: QuickPickItem[] | undefined,
  config: ContinueConfig,
  ide: IDE,
): Promise<string> {
  const contextItems = (
    await Promise.all(
      selectedProviders?.map((selectedProvider) => {
        const provider = config.contextProviders?.find(
          (provider) =>
            provider.description.displayTitle === selectedProvider.label,
        );

        if (!provider) {
          return [];
        }

        return provider.getContextItems("", {
          ide,
          embeddingsProvider: config.embeddingsProvider,
          reranker: config.reranker,
          llm: config.models[0],
          fullInput: "",
          selectedCode: [],
          fetch: (url, init) =>
            fetchwithRequestOptions(url, init, config.requestOptions),
        });
      }) || [],
    )
  ).flat();

  return contextItems.map((item) => item.content).join("\n\n") + "\n\n---\n\n";
}

export async function getContextProviderQuickPickVal(
  config: ContinueConfig,
  ide: IDE,
) {
  const contextProviderItems = await getContextProviderItems(config);

  const quickPick = window.createQuickPick();

  quickPick.items = contextProviderItems;
  quickPick.title = "Context providers";
  quickPick.placeholder = "Select a context provider to add to your prompt";
  quickPick.canSelectMany = true;

  quickPick.show();

  const val = await new Promise<string>((resolve) => {
    quickPick.onDidAccept(async () => {
      const selectedItems = Array.from(quickPick.selectedItems);
      const context = await getContextProvidersString(
        selectedItems,
        config,
        ide,
      );
      resolve(context);
    });
  });

  quickPick.dispose();

  return val;
}
