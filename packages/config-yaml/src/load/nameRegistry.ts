import { BLOCK_TYPES, BlockType } from "./getBlockType.js";

export class NameRegistry {
  private records: Map<string, Set<string>>;

  constructor() {
    this.records = new Map();
    for (const blockType of BLOCK_TYPES) {
      this.records.set(blockType, new Set());
    }
  }

  private isRuleDuplicated(rule: any): boolean {
    if (typeof rule === "string") {
      return this.check(rule, "rules");
    } else {
      return this.check(rule.name, "rules");
    }
  }

  private isContextDuplicated(context: any): boolean {
    return this.check(context.provider, "context");
  }

  private isCommonBlockDuplicated(block: any, blockType: BlockType): boolean {
    return this.check(block.name, blockType);
  }

  private check(identifier: string, blockType: BlockType): boolean {
    if (this.records.get(blockType)!.has(identifier)) {
      return true;
    } else {
      this.records.get(blockType)!.add(identifier);
      return false;
    }
  }

  // Check if the name is duplicated within the same blockType
  isDuplicated(
    block: any,
    blockType: BlockType,
    injectError?: (errorMsg: string) => void,
  ): boolean {
    // Not checking any null or undefined object
    if (block === null || block === undefined) {
      return false;
    }

    let exists = false;

    switch (blockType) {
      case "rules":
        if (this.isRuleDuplicated(block)) {
          exists = true;
          injectError?.(
            `Duplicate rules${typeof block === "string" ? "" : ` named ${block.name}`} detected. The duplicate one has been deleted for preventing unexpected behavior.`,
          );
        }
        break;
      case "context":
        if (this.isContextDuplicated(block)) {
          exists = true;
          injectError?.(
            `Duplicate ${block.provider} context providers detected. The duplicate one has been deleted for preventing unexpected behavior.`,
          );
        }
        break;
      default:
        if (this.isCommonBlockDuplicated(block, blockType)) {
          exists = true;
          injectError?.(
            `Duplicate ${blockType} named ${block.name} detected. The duplicate one has been deleted for preventing unexpected behavior.`,
          );
        }
    }

    return exists;
  }
}
