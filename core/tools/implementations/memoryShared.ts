import { promises as fs } from "fs";
import path from "path";

export type MemoryCommand =
  | "view"
  | "create"
  | "delete"
  | "insert"
  | "rename"
  | "str_replace";

export interface BaseMemoryArgs {
  command: MemoryCommand;
}

export interface ViewArgs extends BaseMemoryArgs {
  command: "view";
  path: string;
  view_range?: Array<number | string>;
}

export interface CreateArgs extends BaseMemoryArgs {
  command: "create";
  path: string;
  file_text: string;
}

export interface DeleteArgs extends BaseMemoryArgs {
  command: "delete";
  path: string;
}

export interface InsertArgs extends BaseMemoryArgs {
  command: "insert";
  path: string;
  insert_line: number | string;
  insert_text: string;
}

export interface RenameArgs extends BaseMemoryArgs {
  command: "rename";
  old_path: string;
  new_path: string;
}

export interface StrReplaceArgs extends BaseMemoryArgs {
  command: "str_replace";
  path: string;
  old_str: string;
  new_str: string;
}

export type MemoryArgs =
  | ViewArgs
  | CreateArgs
  | DeleteArgs
  | InsertArgs
  | RenameArgs
  | StrReplaceArgs;

export const MEMORY_DIR_NAME = "memory";
export const MEMORIES_ROOT_NAME = "memories";

export function validateMemoryPath(
  memoryPath: string,
  memoryRoot: string,
): string {
  if (!memoryPath || typeof memoryPath !== "string") {
    throw new Error(
      `Path is required and must be a string, got: ${memoryPath}`,
    );
  }

  // Normalize ".", "", or just "memories" to "/memories"
  let normalizedPath = memoryPath.trim();
  if (
    normalizedPath === "." ||
    normalizedPath === "" ||
    normalizedPath === MEMORIES_ROOT_NAME
  ) {
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

export async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export interface MemoryCommandResult {
  content: string;
  fullPath: string;
}

export async function handleView(
  args: ViewArgs,
  memoryRoot: string,
): Promise<MemoryCommandResult> {
  const fullPath = validateMemoryPath(args.path, memoryRoot);

  if (!(await exists(fullPath))) {
    throw new Error(`Path not found: ${args.path}`);
  }

  const stat = await fs.stat(fullPath);

  if (stat.isDirectory()) {
    const entries = await fs.readdir(fullPath);
    const items: string[] = [];
    for (const entry of entries.sort()) {
      if (entry.startsWith(".")) {
        continue;
      }
      const entryPath = path.join(fullPath, entry);
      const entryStat = await fs.stat(entryPath);
      items.push(entryStat.isDirectory() ? `${entry}/` : entry);
    }

    const header = `Directory: ${args.path}`;
    const content =
      items.length === 0
        ? header
        : `${header}\n${items.map((item) => `- ${item}`).join("\n")}`;
    return { content, fullPath };
  }

  if (stat.isFile()) {
    const fileContent = await fs.readFile(fullPath, "utf-8");
    const lines = fileContent.split("\n");
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

    const content = displayLines
      .map(
        (line, index) =>
          `${String(index + startNumber).padStart(4, " ")}: ${line}`,
      )
      .join("\n");
    return { content, fullPath };
  }

  throw new Error(`Path not found: ${args.path}`);
}

export async function handleCreate(
  args: CreateArgs,
  memoryRoot: string,
): Promise<MemoryCommandResult> {
  const fullPath = validateMemoryPath(args.path, memoryRoot);
  const dir = path.dirname(fullPath);

  if (!(await exists(dir))) {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(fullPath, args.file_text, "utf-8");
  return {
    content: `File created successfully at ${args.path}`,
    fullPath,
  };
}

export async function handleStrReplace(
  args: StrReplaceArgs,
  memoryRoot: string,
): Promise<MemoryCommandResult> {
  const fullPath = validateMemoryPath(args.path, memoryRoot);

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
  return {
    content: `File ${args.path} has been edited`,
    fullPath,
  };
}

export async function handleInsert(
  args: InsertArgs,
  memoryRoot: string,
): Promise<MemoryCommandResult> {
  const fullPath = validateMemoryPath(args.path, memoryRoot);

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
  return {
    content: `Text inserted at line ${lineNumber} in ${args.path}`,
    fullPath,
  };
}

export async function handleDelete(
  args: DeleteArgs,
  memoryRoot: string,
): Promise<MemoryCommandResult> {
  const fullPath = validateMemoryPath(args.path, memoryRoot);

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
    return {
      content: `File deleted: ${args.path}`,
      fullPath: "",
    };
  }
  if (stat.isDirectory()) {
    await fs.rm(fullPath, { recursive: true, force: true });
    return {
      content: `Directory deleted: ${args.path}`,
      fullPath: "",
    };
  }

  throw new Error(`Path not found: ${args.path}`);
}

export async function handleRename(
  args: RenameArgs,
  memoryRoot: string,
): Promise<MemoryCommandResult> {
  const oldFullPath = validateMemoryPath(args.old_path, memoryRoot);
  const newFullPath = validateMemoryPath(args.new_path, memoryRoot);

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
  return {
    content: `Renamed ${args.old_path} to ${args.new_path}`,
    fullPath: newFullPath,
  };
}

export async function executeMemoryCommand(
  args: MemoryArgs,
  memoryRoot: string,
): Promise<MemoryCommandResult> {
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
