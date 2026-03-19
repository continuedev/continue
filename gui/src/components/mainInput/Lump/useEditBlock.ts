import { ModelDescription, RuleMetadata } from "core";
import { DEFAULT_SYSTEM_MESSAGES_URL } from "core/llm/defaultSystemMessages";
import { useContext } from "react";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

export function useEditBlock() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { selectedProfile } = useAuth();

  return (slug?: string, sourceFile?: string) => {
    if (sourceFile) {
      ideMessenger.post("openFile", {
        path: sourceFile,
      });
    } else if (
      selectedProfile?.profileType === "local" &&
      selectedProfile?.uri
    ) {
      ideMessenger.post("openFile", {
        path: selectedProfile.uri,
      });
    } else {
      ideMessenger.post("config/openProfile", {
        profileId: undefined,
      });
    }
  };
}

export function useEditModel() {
  const editBlock = useEditBlock();
  return (model?: ModelDescription | null) => {
    editBlock(undefined, model?.sourceFile);
  };
}

export function useEditDoc() {
  const editBlock = useEditBlock();
  return (
    docConfig?: { uses?: string } | { name: string; sourceFile?: string },
  ) => {
    if (!docConfig) {
      editBlock(undefined, undefined);
      return;
    }
    if ("name" in docConfig) {
      editBlock(undefined, docConfig.sourceFile);
    } else {
      editBlock(docConfig.uses, undefined);
    }
  };
}

export function useOpenRule() {
  const editBlock = useEditBlock();
  const ideMessenger = useContext(IdeMessengerContext);
  return (rule: RuleMetadata) => {
    if (
      rule.source === "default-chat" ||
      rule.source === "default-plan" ||
      rule.source === "default-agent"
    ) {
      ideMessenger.post("openUrl", DEFAULT_SYSTEM_MESSAGES_URL);
    } else {
      editBlock(rule?.slug, rule?.sourceFile);
    }
  };
}
