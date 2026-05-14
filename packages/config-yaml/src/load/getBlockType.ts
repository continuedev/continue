import { z } from "zod";
import { ConfigYaml } from "../schemas/index.js";

export const BLOCK_TYPES = [
  "models",
  "context",
  "data",
  "mcpServers",
  "rules",
  "prompts",
  "docs",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const blockTypeSchema = z.enum(BLOCK_TYPES);

export function getBlockType(block: ConfigYaml): BlockType | undefined {
  let type: BlockType | undefined;
  if (block.context?.length) {
    type = "context";
  } else if (block.models?.length) {
    type = "models";
  } else if (block.docs?.length) {
    type = "docs";
  } else if (block.mcpServers?.length) {
    type = "mcpServers";
  } else if (block.data?.length) {
    type = "data";
  } else if (block.rules?.length) {
    type = "rules";
  } else if (block.prompts?.length) {
    type = "prompts";
  } else {
    type = undefined;
  }

  console.debug(
    `getBlockType: Categorized block "${block.name || "unnamed"}" as type: ${type || "none"}`,
  );
  return type;
}
