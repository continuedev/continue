import { GB } from "./sizeUtils";

export interface SystemRequirements {
  reservedSystemMemory: number;
  reservedGraphicsMemory: number;
}

export const SYSTEM_REQUIREMENTS: SystemRequirements = {
  reservedSystemMemory: 6 * GB,
  reservedGraphicsMemory: 0 * GB,
};
