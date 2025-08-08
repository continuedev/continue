export type ToolParameters = Record<
  string,
  {
    type: string;
    description: string;
    required: boolean;
    items?: {
      type: string;
    };
  }
>;

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
  name: string;
  displayName: string;
  description: string;
  parameters: ToolParameters;
  preprocess?: (args: any) => Promise<PreprocessToolCallResult>;
  run: (args: any) => Promise<string>;
  readonly?: boolean; // Indicates if the tool is readonly
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
