import { BlockType } from "@continuedev/config-yaml";
import { useContext } from "react";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { BaseIconButton } from "./BaseIconButton";
import { getExploreBlocksConfig } from "./exploreBlocksLogic";

export function ExploreBlocksButton(props: { blockType: string }) {
  const { selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);

  const isLocal = selectedProfile?.profileType === "local";

  const handleLocalAdd = (blockType: BlockType) => {
    void ideMessenger.request("config/addLocalWorkspaceBlock", {
      blockType,
    });
  };

  const handleExplore = (blockType: string) => {
    void ideMessenger.request("controlPlane/openUrl", {
      path: `new?type=block&blockType=${blockType}`,
      orgSlug: undefined,
    });
  };

  const config = getExploreBlocksConfig(
    props.blockType,
    isLocal,
    handleLocalAdd,
    handleExplore
  );

  return (
    <BaseIconButton
      icon={config.icon}
      text={config.text}
      onClick={config.action}
    />
  );
}
