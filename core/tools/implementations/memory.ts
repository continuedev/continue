import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { ContextItem, ToolExtras } from "../..";

import { ToolImpl } from ".";
import { getStringArg } from "../parseArgs";

type MemoryCommand =
  | "view"
  | "create"
  | "delete"
  | "insert"
  | "rename"
  | "str_replace";

const MEMORY_DIR_NAME = "memory";
const MEMORIES_ROOT_NAME = "memories";

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

function validateMemoryPath(memoryPath: string, memoryRoot: string): string {
  if (!memoryPath.startsWith(`/${MEMORIES_ROOT_NAME}`)) {
    throw new Error(
      `Path must start with /${MEMORIES_ROOT_NAME}, got: ${memoryPath}`,
    );
  }

  const relative = memoryPath
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

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
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

  switch (command) {
    case "view": {
      const pathArg = getStringArg(args, "path");
      const fullPath = validateMemoryPath(pathArg, memoryRoot);

      if (!(await exists(fullPath))) {
        throw new Error(`Path not found: ${pathArg}`);
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
        const header = `Directory: ${pathArg}`;
        const content =
          items.length === 0
            ? header
            : `${header}\n${items.map((item) => `- ${item}`).join("\n")}`;
        return [formatContextItem(command, pathArg, content, fullPath)];
      }

      if (stat.isFile()) {
        const fileContent = await fs.readFile(fullPath, "utf-8");
        const lines = fileContent.split("\n");
        let displayLines = lines;
        let startNumber = 1;
        const range = coerceRange(args.view_range);
        if (range) {
          const [start, end] = range;
          const startIndex = Math.max(1, Math.trunc(start)) - 1;
          const endIndex =
            end === -1
              ? lines.length
              : Math.max(startIndex + 1, Math.trunc(end));
          displayLines = lines.slice(startIndex, endIndex);
          startNumber = startIndex + 1;
        }
        const numbered = displayLines
          .map(
            (line, index) =>
              `${String(index + startNumber).padStart(4, " ")}: ${line}`,
          )
          .join("\n");
        return [formatContextItem(command, pathArg, numbered, fullPath)];
      }

      throw new Error(`Path not found: ${pathArg}`);
    }
    case "create": {
      const pathArg = getStringArg(args, "path");
      const fullPath = validateMemoryPath(pathArg, memoryRoot);
      const dir = path.dirname(fullPath);

      if (!(await exists(dir))) {
        await fs.mkdir(dir, { recursive: true });
        throw new Error(`Path not found: ${pathArg}`);
      }

      await fs.writeFile(
        fullPath,
        getStringArg(args, "file_text", true),
        "utf-8",
      );
      return [
        formatContextItem(
          command,
          pathArg,
          `File created successfully at ${pathArg}`,
          fullPath,
        ),
      ];
    }
    case "str_replace": {
      const pathArg = getStringArg(args, "path");
      const fullPath = validateMemoryPath(pathArg, memoryRoot);

      if (!(await exists(fullPath))) {
        throw new Error(`File not found: ${pathArg}`);
      }
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) {
        throw new Error(`Path is not a file: ${pathArg}`);
      }

      const oldStr = getStringArg(args, "old_str", true);
      const newStr = getStringArg(args, "new_str", true);
      const current = await fs.readFile(fullPath, "utf-8");
      const count = current.split(oldStr).length - 1;

      if (count === 0) {
        throw new Error(`Text not found in ${pathArg}`);
      }
      if (count > 1) {
        throw new Error(
          `Text appears ${count} times in ${pathArg}. Must be unique.`,
        );
      }

      await fs.writeFile(fullPath, current.replace(oldStr, newStr), "utf-8");
      return [
        formatContextItem(
          command,
          pathArg,
          `File ${pathArg} has been edited`,
          fullPath,
        ),
      ];
    }
    case "insert": {
      const pathArg = getStringArg(args, "path");
      const fullPath = validateMemoryPath(pathArg, memoryRoot);

      if (!(await exists(fullPath))) {
        throw new Error(`File not found: ${pathArg}`);
      }
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) {
        throw new Error(`Path is not a file: ${pathArg}`);
      }

      const insertLine = coerceLineNumber(args.insert_line);
      const insertText = getStringArg(args, "insert_text", true);
      const current = await fs.readFile(fullPath, "utf-8");
      const lines = current.split("\n");

      if (insertLine < 0 || insertLine > lines.length) {
        throw new Error(
          `Invalid insert_line ${args.insert_line}. Must be 0-${lines.length}`,
        );
      }

      lines.splice(insertLine, 0, insertText.replace(/\n$/, ""));
      await fs.writeFile(fullPath, lines.join("\n"), "utf-8");
      return [
        formatContextItem(
          command,
          pathArg,
          `Text inserted at line ${insertLine} in ${pathArg}`,
          fullPath,
        ),
      ];
    }
    case "delete": {
      const pathArg = getStringArg(args, "path");
      const fullPath = validateMemoryPath(pathArg, memoryRoot);

      if (pathArg === `/${MEMORIES_ROOT_NAME}`) {
        throw new Error(
          `Cannot delete the /${MEMORIES_ROOT_NAME} directory itself`,
        );
      }

      if (!(await exists(fullPath))) {
        throw new Error(`Path not found: ${pathArg}`);
      }

      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        await fs.unlink(fullPath);
        return [
          formatContextItem(command, pathArg, `File deleted: ${pathArg}`, ""),
        ];
      }
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
        return [
          formatContextItem(
            command,
            pathArg,
            `Directory deleted: ${pathArg}`,
            "",
          ),
        ];
      }

      throw new Error(`Path not found: ${pathArg}`);
    }
    case "rename": {
      const oldPath = getStringArg(args, "old_path");
      const newPath = getStringArg(args, "new_path");
      const oldFull = validateMemoryPath(oldPath, memoryRoot);
      const newFull = validateMemoryPath(newPath, memoryRoot);

      if (!(await exists(oldFull))) {
        throw new Error(`Source path not found: ${oldPath}`);
      }

      if (await exists(newFull)) {
        throw new Error(`Destination already exists: ${newPath}`);
      }

      const newDir = path.dirname(newFull);
      if (!(await exists(newDir))) {
        await fs.mkdir(newDir, { recursive: true });
      }

      await fs.rename(oldFull, newFull);
      return [
        formatContextItem(
          command,
          `${oldPath} -> ${newPath}`,
          `Renamed ${oldPath} to ${newPath}`,
          newFull,
        ),
      ];
    }
    default:
      throw new Error(`Unsupported memory command: ${command}`);
  }
};
