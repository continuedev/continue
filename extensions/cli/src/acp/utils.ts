import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ContextItem, ToolStatus } from "core/index.js";

import { formatToolArgument } from "../tools/formatters.js";
import { getToolDisplayName } from "../tools/index.js";

export const ACP_PROTOCOL_VERSION = 1;

export type AcpToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "switch_mode"
  | "other";

export type AcpToolStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

export type AcpContentBlock = {
  type: string;
  [key: string]: unknown;
};

export interface PromptConversionResult {
  text: string;
  contextItems: ContextItem[];
}

export function mapToolStatusToAcpStatus(
  status?: ToolStatus,
): AcpToolStatus | undefined {
  switch (status) {
    case "generating":
    case "generated":
      return "pending";
    case "calling":
      return "in_progress";
    case "done":
      return "completed";
    case "errored":
    case "canceled":
      return "failed";
    default:
      return undefined;
  }
}

export function getAcpToolKind(toolName: string): AcpToolKind {
  switch (toolName) {
    case "Read":
    case "List":
    case "Diff":
      return "read";
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "Checklist":
      return "edit";
    case "Search":
      return "search";
    case "Bash":
      return "execute";
    case "Fetch":
      return "fetch";
    default:
      return "other";
  }
}

export function buildToolTitle(
  toolName: string,
  args?: Record<string, unknown>,
): string {
  const displayName = getToolDisplayName(toolName);
  const entries = args ? Object.entries(args) : [];
  if (entries.length === 0) {
    return displayName;
  }

  const [key, value] = entries[0];
  let formattedValue = "";

  if (
    key.toLowerCase().includes("path") ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    formattedValue = formatToolArgument(value);
  } else if (typeof value === "string") {
    const valueLines = value.split("\n");
    if (valueLines.length === 1) {
      formattedValue = formatToolArgument(value);
    } else {
      const firstLine = valueLines[0].trim();
      formattedValue = firstLine
        ? `${formatToolArgument(firstLine)}...`
        : "...";
    }
  }

  if (!formattedValue) {
    return displayName;
  }

  return `${displayName}(${formattedValue})`;
}

function normalizeUri(
  uri: string,
  cwd: string,
): { type: "file" | "url"; value: string } {
  if (uri.startsWith("file://")) {
    return { type: "file", value: fileURLToPath(uri) };
  }
  if (path.isAbsolute(uri)) {
    return { type: "file", value: uri };
  }
  if (!uri.includes("://")) {
    return { type: "file", value: path.resolve(cwd, uri) };
  }
  return { type: "url", value: uri };
}

function nameFromUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith("file://")) {
    const filePath = fileURLToPath(uri);
    return path.basename(filePath);
  }
  if (path.isAbsolute(uri)) {
    return path.basename(uri);
  }
  try {
    return path.basename(new URL(uri).pathname);
  } catch {
    return path.basename(uri);
  }
}

export function convertPromptBlocks(
  blocks: AcpContentBlock[],
  cwd: string,
): PromptConversionResult {
  const textParts: string[] = [];
  const contextItems: ContextItem[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const type = typeof block.type === "string" ? block.type : "";

    if (type === "text" && typeof block.text === "string") {
      textParts.push(block.text);
      continue;
    }

    if (type === "resource") {
      const resource = block.resource as
        | { uri?: string; text?: string; mimeType?: string }
        | undefined;
      if (resource && typeof resource.text === "string") {
        const uri = resource.uri;
        const name =
          (typeof block.name === "string" && block.name) ||
          nameFromUri(uri) ||
          "resource";
        contextItems.push({
          name,
          content: resource.text,
          description:
            (typeof block.description === "string" && block.description) ||
            (uri ? `Embedded resource: ${uri}` : "Embedded resource"),
          uri: uri ? normalizeUri(uri, cwd) : undefined,
        });
      } else if (resource?.uri) {
        textParts.push(`Resource: ${resource.uri}`);
      }
      continue;
    }

    if (type === "resource_link" || type === "resourceLink") {
      const uri =
        (typeof block.uri === "string" && block.uri) ||
        (typeof (block as any).url === "string" && (block as any).url);
      if (uri) {
        const name =
          (typeof block.name === "string" && block.name) ||
          nameFromUri(uri) ||
          "resource";
        const description =
          (typeof block.description === "string" && block.description) || "";
        const detail = description ? ` - ${description}` : "";
        const resolvedUri =
          !uri.includes("://") && cwd ? path.resolve(cwd, uri) : uri;
        textParts.push(`Resource ${name}: ${resolvedUri}${detail}`);
      }
      continue;
    }

    if (typeof block.text === "string") {
      textParts.push(block.text);
    }
  }

  const text = textParts.join("\n").trim();
  if (!text && contextItems.length > 0) {
    return {
      text: "Review the attached context and respond.",
      contextItems,
    };
  }

  return { text, contextItems };
}
