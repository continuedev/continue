import { ModelRole } from "@yutoagentic/config-yaml";
import { ModelDescription } from "core";
import { useContext, useState } from "react";
import Shortcut from "../../../components/gui/Shortcut";
import { useEditModel } from "../../../components/mainInput/Lump/useEditBlock";
import { Toggle } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { getMetaKeyLabel, isJetBrains } from "../../../util";
import { ConfigHeader } from "../components/ConfigHeader";
import { ModelRoleRow } from "../components/ModelRoleRow";
import { SettingsPanel } from "../components/SettingsPanel";

const MODEL_DOCS_URLS = {
  chat: {
    learnMore: "https://docs.yutoagentic.dev/ide-extensions/chat/quick-start",
    setup: "https://docs.yutoagentic.dev/ide-extensions/chat/model-setup",
  },
  autocomplete: {
    learnMore:
      "https://docs.yutoagentic.dev/ide-extensions/autocomplete/quick-start",
    setup:
      "https://docs.yutoagentic.dev/ide-extensions/autocomplete/model-setup",
  },
  edit: {
    learnMore: "https://docs.yutoagentic.dev/ide-extensions/edit/quick-start",
    setup: "https://docs.yutoagentic.dev/ide-extensions/edit/model-setup",
  },
} as const;

export function ModelsSection() {
  const { selectedProfile } = useAuth();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const config = useAppSelector((state) => state.config.config);
  const jetbrains = isJetBrains();
  const metaKey = getMetaKeyLabel();
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

  const handleConfigureModel = useEditModel();

  function handleAddModel() {
    // In browser/dev startup, selectedProfile can be momentarily unset.
    // Default to local flow so model/provider configuration remains accessible.
    const isLocal = !selectedProfile || selectedProfile.profileType === "local";

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
        subtext="Choose the models used for chat, autocomplete, editing, and advanced retrieval workflows."
        onAddClick={handleAddModel}
        addButtonTooltip="Add model"
      />

      <SettingsPanel
        anchorId="primary-roles"
        title="Primary roles"
        description="Core models used for chat, inline completions, and targeted edits."
      >
        <ModelRoleRow
          role="chat"
          displayName="Chat"
          shortcut={
            <span className="text-2xs text-description-muted">
              (<Shortcut>{`cmd ${jetbrains ? "J" : "L"}`}</Shortcut>)
            </span>
          }
          description={
            <span>
              Used in Chat, Plan, Agent mode (
              <a
                href={MODEL_DOCS_URLS.chat.learnMore}
                target="_blank"
                rel="noopener noreferrer"
                className="text-inherit underline hover:brightness-125"
              >
                Learn more
              </a>
              )
            </span>
          }
          models={config.modelsByRole.chat}
          selectedModel={config.selectedModelByRole.chat ?? undefined}
          onSelect={(model) => handleRoleUpdate("chat", model)}
          onConfigure={handleConfigureModel}
          setupURL={MODEL_DOCS_URLS.chat.setup}
        />
        <ModelRoleRow
          role="autocomplete"
          displayName="Autocomplete"
          description={
            <span>
              Used in inline code completions as you type (
              <a
                href={MODEL_DOCS_URLS.autocomplete.learnMore}
                target="_blank"
                rel="noopener noreferrer"
                className="text-inherit underline hover:brightness-125"
              >
                Learn more
              </a>
              )
            </span>
          }
          models={config.modelsByRole.autocomplete}
          selectedModel={config.selectedModelByRole.autocomplete ?? undefined}
          onSelect={(model) => handleRoleUpdate("autocomplete", model)}
          onConfigure={handleConfigureModel}
          setupURL={MODEL_DOCS_URLS.autocomplete.setup}
        />

        {/* Jetbrains has a model selector inline */}
        {!jetbrains && (
          <ModelRoleRow
            role="edit"
            displayName="Edit"
            shortcut={
              <span className="text-2xs text-description-muted">
                (<Shortcut>cmd I</Shortcut>)
              </span>
            }
            description={
              <span>
                Used to transform a selected section of code (
                <a
                  href={MODEL_DOCS_URLS.edit.learnMore}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-inherit underline hover:brightness-125"
                >
                  Learn more
                </a>
                )
              </span>
            }
            models={config.modelsByRole.edit}
            selectedModel={config.selectedModelByRole.edit ?? undefined}
            onSelect={(model) => handleRoleUpdate("edit", model)}
            onConfigure={handleConfigureModel}
            setupURL={MODEL_DOCS_URLS.edit.setup}
          />
        )}
      </SettingsPanel>

      <SettingsPanel
        anchorId="additional-roles"
        title="Additional roles"
        description="Apply, embed, and rerank models used for more specialized workflows."
      >
        <div className="px-4 py-4">
          <Toggle
            isOpen={showAdditionalRoles}
            onToggle={() => setShowAdditionalRoles(!showAdditionalRoles)}
            title="Show additional model roles"
            subtitle="Apply, Embed, Rerank"
          >
            <div className="border-command-border overflow-hidden rounded-lg border border-solid">
              <ModelRoleRow
                role="apply"
                displayName="Apply"
                description="Used to apply generated codeblocks to files"
                models={config.modelsByRole.apply}
                selectedModel={config.selectedModelByRole.apply ?? undefined}
                onSelect={(model) => handleRoleUpdate("apply", model)}
                onConfigure={handleConfigureModel}
                setupURL="https://docs.yutoagentic.dev/customize/model-roles/apply"
              />
              <ModelRoleRow
                role="embed"
                displayName="Embed"
                description="Used to generate and query embeddings for the @codebase and @docs context providers"
                models={config.modelsByRole.embed}
                selectedModel={config.selectedModelByRole.embed ?? undefined}
                onSelect={(model) => handleRoleUpdate("embed", model)}
                onConfigure={handleConfigureModel}
                setupURL="https://docs.yutoagentic.dev/customize/model-roles/embeddings"
              />
              <ModelRoleRow
                role="rerank"
                displayName="Rerank"
                description="Used for reranking results from the @codebase and @docs context providers"
                models={config.modelsByRole.rerank}
                selectedModel={config.selectedModelByRole.rerank ?? undefined}
                onSelect={(model) => handleRoleUpdate("rerank", model)}
                onConfigure={handleConfigureModel}
                setupURL="https://docs.yutoagentic.dev/customize/model-roles/reranking"
              />
            </div>
          </Toggle>
        </div>
      </SettingsPanel>
    </div>
  );
}
