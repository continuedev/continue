import { EnhancedStore } from "@reduxjs/toolkit";
import { BrowserSerializedContinueConfig, ModelDescription } from "core";
import { SerializedOrgWithProfiles } from "core/config/ProfileLifecycleManager";
import { copyOf } from "core/util";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";

interface TestConfigUpdateParams {
  store: EnhancedStore;
  ideMessenger: MockIdeMessenger;
  newProfileId?: string;
  newOrgId?: string;
  newOrgs?: SerializedOrgWithProfiles[];
  editConfig?: (
    current: BrowserSerializedContinueConfig,
  ) => BrowserSerializedContinueConfig;
}

export function triggerConfigUpdate({
  store,
  ideMessenger,
  editConfig,
  newOrgs,
  newOrgId,
  newProfileId,
}: TestConfigUpdateParams) {
  const state = store.getState();
  ideMessenger.mockMessageToWebview("configUpdate", {
    organizations: newOrgs ?? state.profiles.organizations,
    selectedOrgId: newOrgId ?? state.profiles.selectedOrganizationId,
    profileId: newProfileId ?? state.profiles.selectedProfileId,
    result: {
      config: editConfig
        ? editConfig(copyOf(state.config.config))
        : state.config.config,
      configLoadInterrupted: false,
      errors: [],
    },
  });
}

export function addAndSelectChatModel(
  store: EnhancedStore,
  ideMessenger: MockIdeMessenger,
  llmDesc: ModelDescription,
) {
  triggerConfigUpdate({
    store,
    ideMessenger,
    editConfig(current) {
      current.modelsByRole.chat.push(llmDesc);
      current.selectedModelByRole.chat = llmDesc;
      return current;
    },
  });
}

export function addAndSelectMockLlm(
  store: EnhancedStore,
  ideMessenger: MockIdeMessenger,
) {
  addAndSelectChatModel(store, ideMessenger, {
    model: "mock",
    provider: "mock",
    title: "Mock LLM",
    underlyingProviderName: "mock",
  });
}
