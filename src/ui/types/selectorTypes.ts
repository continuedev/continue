// Type definitions for selectors - compatible with existing hook interfaces

export interface ConfigOption {
  id: string;
  name: string;
  type: "local" | "assistant" | "create";
  slug?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  index: number;
  provider: string;
}
