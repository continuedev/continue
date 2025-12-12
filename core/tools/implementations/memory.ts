import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { ContextItem, ToolExtras } from "../..";

import { ToolImpl } from ".";
import { getStringArg } from "../parseArgs";
import {
  executeMemoryCommand,
  MEMORIES_ROOT_NAME,
  MEMORY_DIR_NAME,
  MemoryArgs,
  MemoryCommand,
} from "./memoryShared";

async function ensureMemoryRoot(extras: ToolExtras): Promise<string> {
  const workspaceDirs = await extras.ide.getWorkspaceDirs();
  const workspaceDir = workspaceDirs[0];
  if (!workspaceDir) {
    throw new Error(
      "Memory tool requires a workspace. Please open a workspace so memories can be stored in its .continue directory.",
    );
  }

  const workspacePath = workspaceDir.startsWith("file://")
    ? fileURLToPath(workspaceDir)
    : workspaceDir;

  const continueDir = path.join(workspacePath, ".continue");
  const memoryDir = path.join(continueDir, MEMORY_DIR_NAME);
  const memoryRoot = path.join(memoryDir, MEMORIES_ROOT_NAME);

  await fs.mkdir(continueDir, { recursive: true });
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(memoryRoot, { recursive: true });
  return memoryRoot;
}

function formatContextItem(
  command: MemoryCommand,
  pathArg: string,
  content: string,
  fullPath: string,
): ContextItem {
  return {
    name: "Memory",
    description: `${command.toUpperCase()} ${pathArg}`,
    content,
    uri: fullPath
      ? {
          type: "file",
          value: pathToFileURL(fullPath).href,
        }
      : undefined,
  } as ContextItem;
}

function coerceLineNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error(
    `Invalid insert_line ${raw}. Must be an integer greater than or equal to 0`,
  );
}

function coerceRange(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }
  const start = Number(value[0]);
  const end = Number(value[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return undefined;
  }
  return [start, end];
}

export const memoryToolImpl: ToolImpl = async (args, extras) => {
  const command = getStringArg(args, "command") as MemoryCommand;
  const memoryRoot = await ensureMemoryRoot(extras);

  // Build the MemoryArgs object based on the command
  let memoryArgs: MemoryArgs;
  switch (command) {
    case "view":
      memoryArgs = {
        command,
        path: getStringArg(args, "path"),
        view_range: args.view_range ? coerceRange(args.view_range) : undefined,
      };
      break;
    case "create":
      memoryArgs = {
        command,
        path: getStringArg(args, "path"),
        file_text: getStringArg(args, "file_text", true),
      };
      break;
    case "str_replace":
      memoryArgs = {
        command,
        path: getStringArg(args, "path"),
        old_str: getStringArg(args, "old_str", true),
        new_str: getStringArg(args, "new_str", true),
      };
      break;
    case "insert":
      memoryArgs = {
        command,
        path: getStringArg(args, "path"),
        insert_line: coerceLineNumber(args.insert_line),
        insert_text: getStringArg(args, "insert_text", true),
      };
      break;
    case "delete":
      memoryArgs = {
        command,
        path: getStringArg(args, "path"),
      };
      break;
    case "rename":
      memoryArgs = {
        command,
        old_path: getStringArg(args, "old_path"),
        new_path: getStringArg(args, "new_path"),
      };
      break;
    default:
      throw new Error(`Unsupported memory command: ${command}`);
  }

  // Execute the command using shared logic
  const result = await executeMemoryCommand(memoryArgs, memoryRoot);

  // Format result as ContextItem
  const pathArg =
    "path" in memoryArgs
      ? memoryArgs.path
      : `${memoryArgs.old_path} -> ${memoryArgs.new_path}`;

  return [formatContextItem(command, pathArg, result.content, result.fullPath)];
};
