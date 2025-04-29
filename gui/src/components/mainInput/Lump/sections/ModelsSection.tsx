import { ModelRole } from "@continuedev/config-yaml";
import { ModelDescription } from "core";
import { useAuth } from "../../../../context/Auth";
import ModelRoleSelector from "../../../../pages/config/ModelRoleSelector";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { updateSelectedModelByRole } from "../../../../redux/thunks";
import { isJetBrains } from "../../../../util";
import { ExploreBlocksButton } from "./ExploreBlocksButton";

export function ModelsSection() {
  const { selectedProfile } = useAuth();
  const dispatch = useAppDispatch();

  const config = useAppSelector((state) => state.config.config);
  const jetbrains = isJetBrains();

  function handleRoleUpdate(role: ModelRole, model: ModelDescription | null) {
    if (!model) {
      return;
    }

    dispatch(
      updateSelectedModelByRole({
        role,
        selectedProfile,
        modelTitle: model.title,
      }),
    );
  }

  return (
    <div>
      <div className="text-[${getFontSize() - 1}px] grid grid-cols-1 gap-x-2 gap-y-1 pb-2 sm:grid-cols-[auto_1fr]">
        <ModelRoleSelector
          displayName="Chat"
          description="Used in the chat interface"
          models={config.modelsByRole.chat}
          selectedModel={config.selectedModelByRole.chat}
          onSelect={(model) => handleRoleUpdate("chat", model)}
        />
        <ModelRoleSelector
          displayName="Autocomplete"
          description="Used to generate code completion suggestions"
          models={config.modelsByRole.autocomplete}
          selectedModel={config.selectedModelByRole.autocomplete}
          onSelect={(model) => handleRoleUpdate("autocomplete", model)}
        />
        {/* Jetbrains has a model selector inline */}
        {!jetbrains && (
          <ModelRoleSelector
            displayName="Edit"
            description="Used for inline edits"
            models={config.modelsByRole.edit}
            selectedModel={config.selectedModelByRole.edit}
            onSelect={(model) => handleRoleUpdate("edit", model)}
          />
        )}
        <ModelRoleSelector
          displayName="Apply"
          description="Used to apply generated codeblocks to files"
          models={config.modelsByRole.apply}
          selectedModel={config.selectedModelByRole.apply}
          onSelect={(model) => handleRoleUpdate("apply", model)}
        />
        <ModelRoleSelector
          displayName="Embed"
          description="Used to generate and query embeddings for the @codebase and @docs context providers"
          models={config.modelsByRole.embed}
          selectedModel={config.selectedModelByRole.embed}
          onSelect={(model) => handleRoleUpdate("embed", model)}
        />
        <ModelRoleSelector
          displayName="Rerank"
          description="Used for reranking results from the @codebase and @docs context providers"
          models={config.modelsByRole.rerank}
          selectedModel={config.selectedModelByRole.rerank}
          onSelect={(model) => handleRoleUpdate("rerank", model)}
        />
      </div>
      <ExploreBlocksButton blockType={"models"} />
    </div>
  );
}
