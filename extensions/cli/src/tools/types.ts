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
  context?: { toolCallId: string };
}

export interface ToolRunContext {
  toolCallId: string;
  /**
   * Number of tool calls being executed in parallel.
   * Tools should divide their output limits by this number to avoid context overflow.
   */
  parallelToolCallCount: number;
  /**
   * The signal of the turn this call belongs to. It aborts when the person
   * cancels the turn (Esc in the TUI, an interrupt in `serve`, a signal in
   * headless mode); long-running tools should stop when it does.
   */
  abortSignal?: AbortSignal;
  /**
   * The permission prompt of the session that made this call, when it has
   * one. Lets a tool that runs its own agent loop (a subagent) put that
   * loop's "ask" calls in front of the person.
   */
  onToolPermissionRequest?: ToolPermissionPrompt;
}

export type ToolPermissionPrompt = (
  toolName: string,
  toolArgs: any,
  requestId: string,
  preview?: ToolCallPreview[],
) => void;

export interface Tool {
  name: string;
  displayName: string;
  description: string;
  parameters: ToolParametersSchema;
  preprocess?: (args: any) => Promise<PreprocessToolCallResult>;
  run: (args: any, context?: ToolRunContext) => Promise<string>;
  readonly?: boolean; // Indicates if the tool is readonly
  isBuiltIn: boolean;
  evaluateToolCallPolicy?: (
    basePolicy: ToolPolicy,
    parsedArgs: Record<string, unknown>,
  ) => ToolPolicy;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  argumentsStr: string;
  startNotified: boolean;
  extra_content?: Record<string, unknown>;
}

export interface PreprocessedToolCall extends ToolCall {
  tool: Tool;
  preprocessResult?: PreprocessToolCallResult;
}
