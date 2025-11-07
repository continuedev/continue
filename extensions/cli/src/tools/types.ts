import type { ToolPolicy } from "@continuedev/terminal-security";

// JSON Schema compatible parameter definition
export interface ParameterSchema {
  type: string;
  description: string;
  required?: string[];
  properties?: Record<string, ParameterSchema>;
  items?: {
    type: string;
    properties?: Record<string, ParameterSchema>;
    required?: string[];
  };
}

export interface ToolParametersSchema {
  type: "object";
  required?: string[];
  properties: Record<string, ParameterSchema>;
}

export interface ToolCallPreview {
  type: "text" | "diff" | "checklist";
  content: string;
  color?: string;
  paddingLeft?: number;
}

export interface PreprocessToolCallResult {
  preview?: ToolCallPreview[];
  args: Record<string, any>;
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
    strict?: boolean | null;
  };
  displayTitle: string;
  wouldLikeTo?: string;
  isCurrently?: string;
  hasAlready?: string;
  readonly: boolean;
  isInstant?: boolean;
  uri?: string;
  faviconUrl?: string;
  group: string;
  originalFunctionName?: string;
  systemMessageDescription?: {
    prefix: string;
    exampleArgs?: Array<[string, string | number]>;
  };
  defaultToolPolicy?: ToolPolicy;
  toolCallIcon?: string;
  preprocessArgs?: (
    args: Record<string, unknown>,
    extras: {
      ide: any; // IDE interface
    },
  ) => Promise<Record<string, unknown>>;
  evaluateToolCallPolicy?: (
    basePolicy: ToolPolicy,
    parsedArgs: Record<string, unknown>,
    processedArgs?: Record<string, unknown>,
  ) => ToolPolicy;
  // CLI-specific properties
  preprocess?: (args: any) => Promise<PreprocessToolCallResult>;
  run: (args: any) => Promise<string>;
  isBuiltIn: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  argumentsStr: string;
  startNotified: boolean;
}

export interface PreprocessedToolCall extends ToolCall {
  tool: Tool;
  preprocessResult?: PreprocessToolCallResult;
}
