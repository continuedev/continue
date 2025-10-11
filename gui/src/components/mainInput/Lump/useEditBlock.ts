import { ModelDescription } from "core";
import { useContext } from "react";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

export function useEditBlock() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { selectedProfile } = useAuth();

  return (slug?: string, sourceFile?: string) => {
    if (slug) {
      ideMessenger.post("controlPlane/openUrl", {
        path: `${slug}/new-version`,
        orgSlug: undefined,
      });
    } else if (sourceFile) {
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
    } else if (
      selectedProfile?.fullSlug?.ownerSlug &&
      selectedProfile?.fullSlug.packageSlug
    ) {
      ideMessenger.post("controlPlane/openUrl", {
        path: `${selectedProfile.fullSlug.ownerSlug}/${selectedProfile.fullSlug.packageSlug}/new-version`,
        orgSlug: undefined,
      });
    } else {
      // Local etc
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
