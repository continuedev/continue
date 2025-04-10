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
  if (block.context?.length) {
    return "context";
  } else if (block.models?.length) {
    return "models";
  } else if (block.docs?.length) {
    return "docs";
  } else if (block.mcpServers?.length) {
    return "mcpServers";
  } else if (block.data?.length) {
    return "data";
  } else if (block.rules?.length) {
    return "rules";
  } else if (block.prompts?.length) {
    return "prompts";
  } else {
    return undefined;
  }
}
