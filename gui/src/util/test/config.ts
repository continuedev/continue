import { EnhancedStore } from "@reduxjs/toolkit";
import { BrowserSerializedContinueConfig, ModelDescription } from "core";
import { SerializedOrgWithProfiles } from "core/config/ProfileLifecycleManager";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { RootState } from "../../redux/store";

interface TestConfigUpdateParams {
  store: EnhancedStore;
  messenger: MockIdeMessenger;
  newProfileId?: string;
  newOrgId?: string;
  newOrgs?: SerializedOrgWithProfiles[];

  configUpdates?: Partial<BrowserSerializedContinueConfig>;
}

export function triggerConfigUpdate({
  store,
  messenger,
  configUpdates,
  newOrgs,
  newOrgId,
  newProfileId,
}: TestConfigUpdateParams) {
  const state = store.getState();
  messenger.mockMessageToWebview("configUpdate", {
    organizations: newOrgs ?? state.profiles.organizations,
    selectedOrgId: newOrgId ?? state.profiles.selectedOrganizationId,
    profileId: newProfileId ?? state.profiles.selectedProfileId,
    result: {
      config: {
        ...state.config.config,
        ...configUpdates,
      },
      configLoadInterrupted: false,
      errors: [],
    },
  });
}

export function addAndSelectChatModel(
  store: EnhancedStore,
  messenger: MockIdeMessenger,
  llmDesc: ModelDescription,
) {
  const state = store.getState() as RootState;
  triggerConfigUpdate({
    store,
    messenger,
    configUpdates: {
      modelsByRole: {
        ...state.config.config.modelsByRole,
        chat: [...state.config.config.modelsByRole.chat, llmDesc],
      },
      selectedModelByRole: {
        ...state.config.config.selectedModelByRole,
        chat: llmDesc,
      },
    },
  });
}

export function addAndSelectMockLlm(
  store: EnhancedStore,
  messenger: MockIdeMessenger,
) {
  addAndSelectChatModel(store, messenger, {
    model: "mock",
    provider: "mock",
    title: "Mock LLM",
    underlyingProviderName: "mock",
  });
}
