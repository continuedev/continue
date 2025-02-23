import { ContinueConfig } from "core";
import { QuickPickItem, window } from "vscode";

export async function getModelQuickPickVal(
  curModelTitle: string,
  config: ContinueConfig,
) {
  const modelItems: QuickPickItem[] = config.models.map((model) => {
    const isCurModel = curModelTitle === model.title;

    return {
      label: model.title
        ? `${isCurModel ? "$(check)" : "     "} ${model.title}`
        : "Model title not set",
    };
  });

  const selectedItem = await window.showQuickPick(modelItems, {
    title: "Models",
    placeHolder: "Select a model",
  });

  if (!selectedItem) {
    return undefined;
  }

  const selectedModelTitle = config.models.find(
    (model) => model.title && selectedItem.label.includes(model.title),
  )?.title;

  return selectedModelTitle;
}
