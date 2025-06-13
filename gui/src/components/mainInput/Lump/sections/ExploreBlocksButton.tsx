import { BlockType } from "@continuedev/config-yaml";
import {
  ArrowTopRightOnSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { GhostButton } from "../../..";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { fontSize } from "../../../../util";

export function ExploreBlocksButton(props: { blockType: string }) {
  const { selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);

  const isLocal = selectedProfile?.profileType === "local";

  const Icon = isLocal ? PlusIcon : ArrowTopRightOnSquareIcon;
  const text = `${isLocal ? "Add" : "Explore"} ${
    props.blockType === "mcpServers"
      ? "MCP Servers"
      : props.blockType.charAt(0).toUpperCase() + props.blockType.slice(1)
  }`;

  const handleClick = () => {
    if (isLocal) {
      void ideMessenger.request("config/addLocalWorkspaceBlock", {
        blockType: props.blockType as BlockType,
      });
    } else {
      void ideMessenger.request("controlPlane/openUrl", {
        path: `new?type=block&blockType=${props.blockType}`,
        orgSlug: undefined,
      });
    }
  };

  return (
    <GhostButton
      className="w-full cursor-pointer rounded px-2 py-0.5 text-center"
      style={{
        fontSize: fontSize(-3),
      }}
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
    >
      <div className="flex items-center justify-center gap-1">
        <Icon className="h-3 w-3 pr-1" />
        <span className="text-[11px]">{text}</span>
      </div>
    </GhostButton>
  );
}
