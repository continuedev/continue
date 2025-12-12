import { promises as fs } from "fs";
import path from "path";

import {
  executeMemoryCommand,
  MEMORIES_ROOT_NAME,
  MEMORY_DIR_NAME,
  MemoryArgs,
  MemoryCommand,
} from "core/tools/implementations/memoryShared.js";

import { Tool } from "./types.js";

async function ensureMemoryRoot(): Promise<string> {
  const workspaceContinueDir = path.join(process.cwd(), ".continue");
  const memoryDir = path.join(workspaceContinueDir, MEMORY_DIR_NAME);
  const memoryRoot = path.join(memoryDir, MEMORIES_ROOT_NAME);

  await fs.mkdir(workspaceContinueDir, { recursive: true });
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(memoryRoot, { recursive: true });
  return memoryRoot;
}

export const memoryTool: Tool = {
  name: "memory",
  type: "memory_20250818",
  displayName: "Memory",
  description: "Anthropic claude memory tool",
  parameters: {
    type: "object",
    required: ["command"],
    properties: {
      command: {
        type: "string",
        description:
          "The memory command to run. One of view, create, insert, str_replace, delete, or rename.",
      },
      path: {
        type: "string",
        description: "Target path inside the /memories namespace.",
      },
      view_range: {
        type: "array",
        description: "Optional [start, end] line range when viewing a file.",
        items: { type: "number" },
      },
      file_text: {
        type: "string",
        description: "File contents used with the create command.",
      },
      insert_line: {
        type: "number",
        description:
          "Line index (0-based) where new text should be inserted for the insert command.",
      },
      insert_text: {
        type: "string",
        description:
          "Text to insert at the provided line when using the insert command.",
      },
      old_path: {
        type: "string",
        description: "Existing path to rename when using the rename command.",
      },
      new_path: {
        type: "string",
        description: "New path to rename to when using the rename command.",
      },
      old_str: {
        type: "string",
        description: "String to search for with the str_replace command.",
      },
      new_str: {
        type: "string",
        description: "Replacement string used with the str_replace command.",
      },
    },
  },
  readonly: false,
  isBuiltIn: true,
  run: async (rawArgs: any): Promise<string> => {
    try {
      if (!rawArgs || typeof rawArgs.command !== "string") {
        throw new Error(
          "The `command` argument is required for the memory tool",
        );
      }

      const command = rawArgs.command as MemoryCommand;
      const memoryRoot = await ensureMemoryRoot();
      const result = await executeMemoryCommand(
        { ...rawArgs, command } as MemoryArgs,
        memoryRoot,
      );
      return result.content;
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
