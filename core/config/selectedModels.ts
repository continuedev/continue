import { ModelRole } from "@continuedev/config-yaml";

import { ContinueConfig, ILLM } from "..";
import { LLMConfigurationStatuses } from "../llm/constants";
import {
  GlobalContext,
  GlobalContextModelSelections,
} from "../util/GlobalContext";

export function rectifySelectedModelsFromGlobalContext(
  continueConfig: ContinueConfig,
  profileId: string,
): ContinueConfig {
  const configCopy = { ...continueConfig };

  const globalContext = new GlobalContext();
  const currentSelectedModels = globalContext.get("selectedModelsByProfileId");
  const currentForProfile: GlobalContextModelSelections =
    currentSelectedModels?.[profileId] ?? {};

  let fellBack = false;

  // summarize not implemented yet
  const roles: ModelRole[] = [
    "autocomplete",
    "apply",
    "edit",
    "embed",
    "rerank",
    "chat",
  ];

  for (const role of roles) {
    let newModel: ILLM | null = null;
    const currentSelection = currentForProfile[role] ?? null;

    if (currentSelection) {
      const match = continueConfig.modelsByRole[role].find(
        (m) => m.title === currentSelection,
      );
      if (match) {
        newModel = match;
      }
    }

    if (!newModel && continueConfig.modelsByRole[role].length > 0) {
      newModel = continueConfig.modelsByRole[role][0];
    }

    if (!(currentSelection === (newModel?.title ?? null))) {
      fellBack = true;
    }

    // Currently only check for configuration status for apply
    if (
      role === "apply" &&
      newModel?.getConfigurationStatus() !== LLMConfigurationStatuses.VALID
    ) {
      break;
    }

    configCopy.selectedModelByRole[role] = newModel;
  }

  // In the case shared config wasn't respected,
  // Rewrite the shared config
  if (fellBack) {
    globalContext.update("selectedModelsByProfileId", {
      ...currentSelectedModels,
      [profileId]: Object.fromEntries(
        Object.entries(configCopy.selectedModelByRole).map(([key, value]) => [
          key,
          value?.title ?? null,
        ]),
      ),
    });
  }

  return configCopy;
}
