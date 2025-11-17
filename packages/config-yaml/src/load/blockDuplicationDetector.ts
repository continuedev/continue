import {
  ARRAY_BLOCK_TYPES,
  BlockType,
  isArrayBlockType,
} from "./getBlockType.js";

export class BlockDuplicationDetector {
  private records: Map<string, Set<string>>;

  constructor() {
    this.records = new Map();
    for (const blockType of ARRAY_BLOCK_TYPES) {
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
    const record = this.records.get(blockType);
    if (!record) {
      return false;
    }

    if (record.has(identifier)) {
      return true;
    } else {
      record.add(identifier);
      return false;
    }
  }

  // Check if the name is duplicated within the same blockType
  isDuplicated(block: any, blockType: BlockType): boolean {
    if (!isArrayBlockType(blockType)) {
      return false;
    }

    // Not checking any null or undefined object
    if (block === null || block === undefined) {
      return false;
    }

    switch (blockType) {
      case "rules":
        if (this.isRuleDuplicated(block)) {
          return true;
        }
        return false;
      case "context":
        if (this.isContextDuplicated(block)) {
          return true;
        }
        return false;
      default:
        if (this.isCommonBlockDuplicated(block, blockType)) {
          return true;
        }
        return false;
    }
  }
}
