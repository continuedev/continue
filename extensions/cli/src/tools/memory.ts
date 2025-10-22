import { promises as fs } from "fs";
import path from "path";

import { Tool } from "./types.js";

type MemoryCommand =
  | "view"
  | "create"
  | "delete"
  | "insert"
  | "rename"
  | "str_replace";

interface BaseMemoryArgs {
  command: MemoryCommand;
}

interface ViewArgs extends BaseMemoryArgs {
  command: "view";
  path: string;
  view_range?: Array<number | string>;
}

interface CreateArgs extends BaseMemoryArgs {
  command: "create";
  path: string;
  file_text: string;
}

interface DeleteArgs extends BaseMemoryArgs {
  command: "delete";
  path: string;
}

interface InsertArgs extends BaseMemoryArgs {
  command: "insert";
  path: string;
  insert_line: number | string;
  insert_text: string;
}

interface RenameArgs extends BaseMemoryArgs {
  command: "rename";
  old_path: string;
  new_path: string;
}

interface StrReplaceArgs extends BaseMemoryArgs {
  command: "str_replace";
  path: string;
  old_str: string;
  new_str: string;
}

type MemoryArgs =
  | ViewArgs
  | CreateArgs
  | DeleteArgs
  | InsertArgs
  | RenameArgs
  | StrReplaceArgs;

const MEMORY_DIR_NAME = "memory";
const MEMORIES_ROOT_NAME = "memories";

async function ensureMemoryRoot(): Promise<string> {
  const workspaceContinueDir = path.join(process.cwd(), ".continue");
  const memoryDir = path.join(workspaceContinueDir, MEMORY_DIR_NAME);
  const memoryRoot = path.join(memoryDir, MEMORIES_ROOT_NAME);

  await fs.mkdir(workspaceContinueDir, { recursive: true });
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.mkdir(memoryRoot, { recursive: true });
  return memoryRoot;
}

function validatePath(memoryPath: string, memoryRoot: string): string {
  if (!memoryPath || typeof memoryPath !== "string") {
    throw new Error(
      `Path is required and must be a string, got: ${memoryPath}`,
    );
  }

  // Normalize ".", "", or just "memories" to "/memories"
  let normalizedPath = memoryPath.trim();
  if (normalizedPath === "." || normalizedPath === "" || normalizedPath === MEMORIES_ROOT_NAME) {
    normalizedPath = `/${MEMORIES_ROOT_NAME}`;
  }

  // Add leading slash if missing
  if (!normalizedPath.startsWith("/")) {
    normalizedPath = `/${normalizedPath}`;
  }

  // Ensure path starts with /memories
  if (!normalizedPath.startsWith(`/${MEMORIES_ROOT_NAME}`)) {
    throw new Error(
      `Path must start with /${MEMORIES_ROOT_NAME}, got: ${memoryPath}`,
    );
  }

  const relative = normalizedPath
    .slice(MEMORIES_ROOT_NAME.length + 1)
    .replace(/^\/+/, "");
  const resolved = path.resolve(memoryRoot, relative.length ? relative : ".");
  const normalizedRoot = path.resolve(memoryRoot);

  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(
      `Path ${memoryPath} would escape /${MEMORIES_ROOT_NAME} directory`,
    );
  }

  return resolved;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function handleView(args: ViewArgs, memoryRoot: string): Promise<string> {
  const fullPath = validatePath(args.path, memoryRoot);

  if (!(await exists(fullPath))) {
    throw new Error(`Path not found: ${args.path}`);
  }

  const stat = await fs.stat(fullPath);

  if (stat.isDirectory()) {
    const entries = await fs.readdir(fullPath);
    const items = [] as string[];
    for (const entry of entries.sort()) {
      if (entry.startsWith(".")) {
        continue;
      }
      const entryPath = path.join(fullPath, entry);
      const entryStat = await fs.stat(entryPath);
      items.push(entryStat.isDirectory() ? `${entry}/` : entry);
    }

    const header = `Directory: ${args.path}`;
    if (items.length === 0) {
      return `${header}`;
    }
    return `${header}\n${items.map((item) => `- ${item}`).join("\n")}`;
  }

  if (stat.isFile()) {
    const content = await fs.readFile(fullPath, "utf-8");
    const lines = content.split("\n");
    let displayLines = lines;
    let startNumber = 1;

    if (Array.isArray(args.view_range) && args.view_range.length === 2) {
      const start = Number(args.view_range[0]);
      const endRaw = Number(args.view_range[1]);
      const startIndex = Number.isFinite(start) ? Math.max(1, start) - 1 : 0;
      const endIndex =
        Number.isFinite(endRaw) && endRaw !== -1
          ? Math.max(startIndex + 1, endRaw)
          : lines.length;
      displayLines = lines.slice(startIndex, endIndex);
      startNumber = startIndex + 1;
    }

    return displayLines
      .map(
        (line, index) =>
          `${String(index + startNumber).padStart(4, " ")}: ${line}`,
      )
      .join("\n");
  }

  throw new Error(`Path not found: ${args.path}`);
}

async function handleCreate(
  args: CreateArgs,
  memoryRoot: string,
): Promise<string> {
  const fullPath = validatePath(args.path, memoryRoot);
  const dir = path.dirname(fullPath);

  if (!(await exists(dir))) {
    await fs.mkdir(dir, { recursive: true });
    throw new Error(`Path not found: ${args.path}`);
  }

  await fs.writeFile(fullPath, args.file_text, "utf-8");
  return `File created successfully at ${args.path}`;
}

async function handleStrReplace(
  args: StrReplaceArgs,
  memoryRoot: string,
): Promise<string> {
  const fullPath = validatePath(args.path, memoryRoot);

  if (!(await exists(fullPath))) {
    throw new Error(`File not found: ${args.path}`);
  }

  const stat = await fs.stat(fullPath);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${args.path}`);
  }

  const content = await fs.readFile(fullPath, "utf-8");
  const occurrences = content.split(args.old_str).length - 1;

  if (occurrences === 0) {
    throw new Error(`Text not found in ${args.path}`);
  }
  if (occurrences > 1) {
    throw new Error(
      `Text appears ${occurrences} times in ${args.path}. Must be unique.`,
    );
  }

  await fs.writeFile(
    fullPath,
    content.replace(args.old_str, args.new_str),
    "utf-8",
  );
  return `File ${args.path} has been edited`;
}

async function handleInsert(
  args: InsertArgs,
  memoryRoot: string,
): Promise<string> {
  const fullPath = validatePath(args.path, memoryRoot);

  if (!(await exists(fullPath))) {
    throw new Error(`File not found: ${args.path}`);
  }

  const stat = await fs.stat(fullPath);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${args.path}`);
  }

  const content = await fs.readFile(fullPath, "utf-8");
  const lines = content.split("\n");
  const lineNumber = Number(args.insert_line);

  if (
    !Number.isInteger(lineNumber) ||
    lineNumber < 0 ||
    lineNumber > lines.length
  ) {
    throw new Error(
      `Invalid insert_line ${args.insert_line}. Must be 0-${lines.length}`,
    );
  }

  lines.splice(lineNumber, 0, args.insert_text.replace(/\n$/, ""));
  await fs.writeFile(fullPath, lines.join("\n"), "utf-8");
  return `Text inserted at line ${lineNumber} in ${args.path}`;
}

async function handleDelete(
  args: DeleteArgs,
  memoryRoot: string,
): Promise<string> {
  const fullPath = validatePath(args.path, memoryRoot);

  if (args.path === `/${MEMORIES_ROOT_NAME}`) {
    throw new Error(
      `Cannot delete the /${MEMORIES_ROOT_NAME} directory itself`,
    );
  }

  if (!(await exists(fullPath))) {
    throw new Error(`Path not found: ${args.path}`);
  }

  const stat = await fs.stat(fullPath);
  if (stat.isFile()) {
    await fs.unlink(fullPath);
    return `File deleted: ${args.path}`;
  }
  if (stat.isDirectory()) {
    await fs.rm(fullPath, { recursive: true, force: true });
    return `Directory deleted: ${args.path}`;
  }

  throw new Error(`Path not found: ${args.path}`);
}

async function handleRename(
  args: RenameArgs,
  memoryRoot: string,
): Promise<string> {
  const oldFullPath = validatePath(args.old_path, memoryRoot);
  const newFullPath = validatePath(args.new_path, memoryRoot);

  if (!(await exists(oldFullPath))) {
    throw new Error(`Source path not found: ${args.old_path}`);
  }

  if (await exists(newFullPath)) {
    throw new Error(`Destination already exists: ${args.new_path}`);
  }

  const newDir = path.dirname(newFullPath);
  if (!(await exists(newDir))) {
    await fs.mkdir(newDir, { recursive: true });
  }

  await fs.rename(oldFullPath, newFullPath);
  return `Renamed ${args.old_path} to ${args.new_path}`;
}

async function executeMemoryCommand(args: MemoryArgs): Promise<string> {
  const memoryRoot = await ensureMemoryRoot();

  switch (args.command) {
    case "view":
      return handleView(args, memoryRoot);
    case "create":
      return handleCreate(args, memoryRoot);
    case "delete":
      return handleDelete(args, memoryRoot);
    case "insert":
      return handleInsert(args, memoryRoot);
    case "rename":
      return handleRename(args, memoryRoot);
    case "str_replace":
      return handleStrReplace(args, memoryRoot);
    default:
      throw new Error(
        `Unsupported command: ${(args as BaseMemoryArgs).command}`,
      );
  }
}

export const memoryTool: Tool = {
  name: "memory",
  type: "memory_20250818",
  displayName: "Memory",
  description:
    "Anthropic claude memory tool",
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
      return await executeMemoryCommand({ ...rawArgs, command } as MemoryArgs);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
