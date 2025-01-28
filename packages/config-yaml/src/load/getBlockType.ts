import { ConfigYaml } from "../schemas/index.js";

export type BlockType =
  | "models"
  | "context"
  | "docs"
  | "tools"
  | "mcpServers"
  | "data"
  | "rules"
  | "prompts";
export function getBlockType(block: ConfigYaml): BlockType {
  if (block.context?.length) {
    return "context";
  } else if (block.models?.length) {
    return "models";
  } else if (block.docs?.length) {
    return "docs";
  } else if (block.tools?.length) {
    return "tools";
  } else if (block.mcpServers?.length) {
    return "mcpServers";
  } else if (block.data?.length) {
    return "data";
  } else if (block.rules?.length) {
    return "rules";
  } else if (block.prompts?.length) {
    return "prompts";
  } else {
    throw new Error("Unknown block type");
  }
}
