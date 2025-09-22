/**
 * Type definitions for selectors - compatible with existing hook interfaces
 */

import type { SelectorOption } from "../Selector.js";

export interface ConfigOption extends SelectorOption {
  type: "local" | "assistant" | "create";
  slug?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  index: number;
  provider: string;
}
