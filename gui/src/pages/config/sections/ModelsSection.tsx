import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { ModelRole } from "@continuedev/config-yaml";
import { ModelDescription } from "core";
import { useContext } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Card } from "../../../components/ui";
import { Divider } from "../../../components/ui/Divider";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { isJetBrains } from "../../../util";
import { ConfigHeader } from "../ConfigHeader";
import ModelRoleSelector from "../components/ModelRoleSelector";

export function ModelsSection() {
  const { selectedProfile } = useAuth();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const config = useAppSelector((state) => state.config.config);
  const jetbrains = isJetBrains();

  function handleRoleUpdate(role: ModelRole, model: ModelDescription | null) {
    if (!model) {
      return;
    }

    void dispatch(
      updateSelectedModelByRole({
        role,
        selectedProfile,
        modelTitle: model.title,
      }),
    );
  }

  function handleConfigureModel(model: ModelDescription | null) {
    if (!model) {
      return;
    }
    
    ideMessenger.post("config/openProfile", {
      profileId: undefined,
      element: model,
    });
  }

  function handleAddModel() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  return (
    <div>
      <ConfigHeader
        title="Models"
        onAddClick={
          selectedProfile?.profileType === "local" ? handleAddModel : undefined
        }
        addButtonTooltip="Add a model"
      />

      <Card>
        <div className="pb-6">
          <div className="mb-2">
            <span className="text-base font-medium">Chat</span>
            <p className="mt-1 text-sm text-gray-500">
              Used in the chat interface
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModelRoleSelector
                displayName="Chat"
                description="Used in the chat interface"
                models={config.modelsByRole.chat}
                selectedModel={config.selectedModelByRole.chat}
                onSelect={(model) => handleRoleUpdate("chat", model)}
                setupURL="https://docs.continue.dev/chat/model-setup"
                hideTitle={true}
              />
            </div>
            {config.selectedModelByRole.chat && (
              <ToolTip content="Configure">
                <Cog6ToothIcon
                  className="h-4 w-4 cursor-pointer text-description-muted hover:text-foreground"
                  onClick={() => handleConfigureModel(config.selectedModelByRole.chat)}
                />
              </ToolTip>
            )}
          </div>
        </div>

        <Divider />

        <div className="pt-6">
          <div className="mb-2">
            <span className="text-base font-medium">Autocomplete</span>
            <p className="mt-1 text-sm text-gray-500">
              Used to generate code completion suggestions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModelRoleSelector
                displayName="Autocomplete"
                description="Used to generate code completion suggestions"
                models={config.modelsByRole.autocomplete}
                selectedModel={config.selectedModelByRole.autocomplete}
                onSelect={(model) => handleRoleUpdate("autocomplete", model)}
                setupURL="https://docs.continue.dev/autocomplete/model-setup"
                hideTitle={true}
              />
            </div>
            {config.selectedModelByRole.autocomplete && (
              <ToolTip content="Configure">
                <Cog6ToothIcon
                  className="h-4 w-4 cursor-pointer text-description-muted hover:text-foreground"
                  onClick={() => handleConfigureModel(config.selectedModelByRole.autocomplete)}
                />
              </ToolTip>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-10">
        {/* Jetbrains has a model selector inline */}
        {!jetbrains && (
          <>
            <div className="pb-6">
              <div className="mb-2">
                <span className="text-base font-medium">Edit</span>
                <p className="mt-1 text-sm text-gray-500">
                  Used for inline edits
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ModelRoleSelector
                    displayName="Edit"
                    description="Used for inline edits"
                    models={config.modelsByRole.edit}
                    selectedModel={config.selectedModelByRole.edit}
                    onSelect={(model) => handleRoleUpdate("edit", model)}
                    setupURL="https://docs.continue.dev/edit/model-setup"
                    hideTitle={true}
                  />
                </div>
                {config.selectedModelByRole.edit && (
                  <ToolTip content="Configure">
                    <Cog6ToothIcon
                      className="h-4 w-4 cursor-pointer text-description-muted hover:text-foreground"
                      onClick={() => handleConfigureModel(config.selectedModelByRole.edit)}
                    />
                  </ToolTip>
                )}
              </div>
            </div>

            <Divider />
          </>
        )}

        <div className={jetbrains ? "pb-6" : "py-6"}>
          <div className="mb-2">
            <span className="text-base font-medium">Apply</span>
            <p className="mt-1 text-sm text-gray-500">
              Used to apply generated codeblocks to files
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModelRoleSelector
                displayName="Apply"
                description="Used to apply generated codeblocks to files"
                models={config.modelsByRole.apply}
                selectedModel={config.selectedModelByRole.apply}
                onSelect={(model) => handleRoleUpdate("apply", model)}
                setupURL="https://docs.continue.dev/customize/model-roles/apply"
                hideTitle={true}
              />
            </div>
            {config.selectedModelByRole.apply && (
              <ToolTip content="Configure">
                <Cog6ToothIcon
                  className="h-4 w-4 cursor-pointer text-description-muted hover:text-foreground"
                  onClick={() => handleConfigureModel(config.selectedModelByRole.apply)}
                />
              </ToolTip>
            )}
          </div>
        </div>

        <Divider />

        <div className="py-6">
          <div className="mb-2">
            <span className="text-base font-medium">Embed</span>
            <p className="mt-1 text-sm text-gray-500">
              Used to generate and query embeddings for the @codebase and @docs
              context providers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModelRoleSelector
                displayName="Embed"
                description="Used to generate and query embeddings for the @codebase and @docs context providers"
                models={config.modelsByRole.embed}
                selectedModel={config.selectedModelByRole.embed}
                onSelect={(model) => handleRoleUpdate("embed", model)}
                setupURL="https://docs.continue.dev/customize/model-roles/embeddings"
                hideTitle={true}
              />
            </div>
            {config.selectedModelByRole.embed && (
              <ToolTip content="Configure">
                <Cog6ToothIcon
                  className="h-4 w-4 cursor-pointer text-description-muted hover:text-foreground"
                  onClick={() => handleConfigureModel(config.selectedModelByRole.embed)}
                />
              </ToolTip>
            )}
          </div>
        </div>

        <Divider />

        <div className="pt-6">
          <div className="mb-2">
            <span className="text-base font-medium">Rerank</span>
            <p className="mt-1 text-sm text-gray-500">
              Used for reranking results from the @codebase and @docs context
              providers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModelRoleSelector
                displayName="Rerank"
                description="Used for reranking results from the @codebase and @docs context providers"
                models={config.modelsByRole.rerank}
                selectedModel={config.selectedModelByRole.rerank}
                onSelect={(model) => handleRoleUpdate("rerank", model)}
                setupURL="https://docs.continue.dev/customize/model-roles/reranking"
                hideTitle={true}
              />
            </div>
            {config.selectedModelByRole.rerank && (
              <ToolTip content="Configure">
                <Cog6ToothIcon
                  className="h-4 w-4 cursor-pointer text-description-muted hover:text-foreground"
                  onClick={() => handleConfigureModel(config.selectedModelByRole.rerank)}
                />
              </ToolTip>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
