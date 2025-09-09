import { ModelRole } from "@continuedev/config-yaml";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { ModelDescription } from "core";
import { useContext, useState } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Button, Card, Divider, Toggle } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { isJetBrains } from "../../../util";
import { ConfigHeader } from "../components/ConfigHeader";
import ModelRoleSelector from "../components/ModelRoleSelector";

export function ModelsSection() {
  const { selectedProfile } = useAuth();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const config = useAppSelector((state) => state.config.config);
  const jetbrains = isJetBrains();
  const [showAdditionalRoles, setShowAdditionalRoles] = useState(false);

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
    const isLocal = selectedProfile?.profileType === "local";

    if (isLocal) {
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
    } else {
      void ideMessenger.request("controlPlane/openUrl", {
        path: "?type=models",
        orgSlug: undefined,
      });
    }
  }

  return (
    <div className="space-y-4">
      <ConfigHeader
        title="Models"
        onAddClick={handleAddModel}
        addButtonTooltip="Add model"
      />

      <Card>
        <div className="py-6 first:pt-0 last:pb-0">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleConfigureModel(config.selectedModelByRole.chat)
                }
                className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
              >
                <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
              </Button>
            )}
          </div>
        </div>

        <Divider />

        <div className="py-6 first:pt-0 last:pb-0">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleConfigureModel(
                      config.selectedModelByRole.autocomplete,
                    )
                  }
                  className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
                >
                  <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
                </Button>
              </ToolTip>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <Toggle
          isOpen={showAdditionalRoles}
          onToggle={() => setShowAdditionalRoles(!showAdditionalRoles)}
          title="Additional model roles"
          subtitle="Edit, Apply, Embed, Rerank"
        >
          <div className="flex flex-col gap-6">
            {/* Jetbrains has a model selector inline */}
            {!jetbrains && (
              <>
                <div>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleConfigureModel(
                              config.selectedModelByRole.edit,
                            )
                          }
                          className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
                        >
                          <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
                        </Button>
                      </ToolTip>
                    )}
                  </div>
                </div>

                <Divider />
              </>
            )}

            <div>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleConfigureModel(config.selectedModelByRole.apply)
                      }
                      className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
                    >
                      <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </ToolTip>
                )}
              </div>
            </div>

            <Divider />

            <div>
              <div className="mb-2">
                <span className="text-base font-medium">Embed</span>
                <p className="mt-1 text-sm text-gray-500">
                  Used to generate and query embeddings for the @codebase and
                  @docs context providers
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleConfigureModel(config.selectedModelByRole.embed)
                      }
                      className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
                    >
                      <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </ToolTip>
                )}
              </div>
            </div>

            <Divider />

            <div>
              <div className="mb-2">
                <span className="text-base font-medium">Rerank</span>
                <p className="mt-1 text-sm text-gray-500">
                  Used for reranking results from the @codebase and @docs
                  context providers
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleConfigureModel(config.selectedModelByRole.rerank)
                      }
                      className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
                    >
                      <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </ToolTip>
                )}
              </div>
            </div>
          </div>
        </Toggle>
      </Card>
    </div>
  );
}
