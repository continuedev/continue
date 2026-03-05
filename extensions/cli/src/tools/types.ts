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
}

/**
 * A multipart tool result that can contain text and images.
 * Used by tools like Read to return image content alongside metadata.
 * In the AI SDK path, image parts are sent as visual content to the model.
 * In the legacy OpenAI path, only text parts are used (graceful fallback).
 */
export interface ToolResultPart {
  type: "text" | "image";
  /** Text content (when type is "text") */
  text?: string;
  /** Base64-encoded image data (when type is "image") */
  data?: string;
  /** MIME type of the image, e.g. "image/png" (when type is "image") */
  mimeType?: string;
}

export interface MultipartToolResult {
  type: "multipart";
  parts: ToolResultPart[];
}

/** The return type of a tool's run function */
export type ToolResult = string | MultipartToolResult;

/** Type guard to check if a tool result is multipart */
export function isMultipartToolResult(
  result: ToolResult,
): result is MultipartToolResult {
  return typeof result === "object" && result.type === "multipart";
}

/**
 * Extract only the text content from a ToolResult.
 * For string results, returns as-is. For multipart, joins all text parts.
 * Used as a fallback when the pipeline doesn't support images.
 */
export function extractTextFromToolResult(result: ToolResult): string {
  if (typeof result === "string") return result;
  return result.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("\n");
}

export interface Tool {
  name: string;
  displayName: string;
  description: string;
  parameters: ToolParametersSchema;
  preprocess?: (args: any) => Promise<PreprocessToolCallResult>;
  run: (args: any, context?: ToolRunContext) => Promise<ToolResult>;
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
}

export interface PreprocessedToolCall extends ToolCall {
  tool: Tool;
  preprocessResult?: PreprocessToolCallResult;
}
