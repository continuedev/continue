import { z } from "zod";
import { ConfigYaml } from "../schemas/index.js";

const arrayBlockTypes = [
  "models",
  "context",
  "data",
  "mcpServers",
  "rules",
  "prompts",
  "docs",
] as const;

export const ARRAY_BLOCK_TYPES = arrayBlockTypes;
export type ArrayBlockType = (typeof ARRAY_BLOCK_TYPES)[number];

export const BLOCK_TYPES = [...ARRAY_BLOCK_TYPES, "experimental"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const blockTypeSchema = z.enum(BLOCK_TYPES);

export function isArrayBlockType(
  blockType: BlockType,
): blockType is ArrayBlockType {
  return blockType !== "experimental";
}

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
  } else if (block.experimental) {
    return "experimental";
  } else {
    return undefined;
  }
}
