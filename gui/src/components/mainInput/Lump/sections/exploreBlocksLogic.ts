import { BlockType } from "@continuedev/config-yaml";
import {
  ArrowTopRightOnSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { ComponentType, SVGProps } from "react";

export interface ExploreBlocksConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  text: string;
  action: () => void;
}

export function getExploreBlocksConfig(
  blockType: string,
  isLocal: boolean,
  onLocalAdd: (blockType: BlockType) => void,
  onExplore: (blockType: string) => void
): ExploreBlocksConfig {
  const Icon = isLocal ? PlusIcon : ArrowTopRightOnSquareIcon;
  
  const text = `${isLocal ? "Add" : "Explore"} ${
    blockType === "mcpServers"
      ? "MCP Servers"
      : blockType.charAt(0).toUpperCase() + blockType.slice(1)
  }`;

  const action = () => {
    if (isLocal) {
      onLocalAdd(blockType as BlockType);
    } else {
      onExplore(blockType);
    }
  };

  return {
    icon: Icon,
    text,
    action,
  };
}

export function formatBlockTypeName(blockType: string): string {
  return blockType === "mcpServers"
    ? "MCP Servers"
    : blockType.charAt(0).toUpperCase() + blockType.slice(1);
}