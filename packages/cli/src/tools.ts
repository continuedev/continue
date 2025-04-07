import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";
const execPromise = util.promisify(child_process.exec);

export interface Tool {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required: boolean;
    }
  >;
  run: (args: any) => Promise<string>;
}

export const tools: Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file at the specified path",
    parameters: {
      filepath: {
        type: "string",
        description: "The path to the file to read",
        required: true,
      },
    },
    run: async (args: { filepath: string }): Promise<string> => {
      try {
        if (!fs.existsSync(args.filepath)) {
          return `Error: File does not exist: ${args.filepath}`;
        }
        const content = fs.readFileSync(args.filepath, "utf-8");
        return `Content of ${args.filepath}:\n${content}`;
      } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: "write_file",
    description: "Write content to a file at the specified path",
    parameters: {
      filepath: {
        type: "string",
        description: "The path to the file to write",
        required: true,
      },
      content: {
        type: "string",
        description: "The content to write to the file",
        required: true,
      },
    },
    run: async (args: {
      filepath: string;
      content: string;
    }): Promise<string> => {
      try {
        const dirPath = path.dirname(args.filepath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(args.filepath, args.content, "utf-8");
        return `Successfully wrote to file: ${args.filepath}`;
      } catch (error) {
        return `Error writing to file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: "list_files",
    description: "List files in a directory",
    parameters: {
      dirpath: {
        type: "string",
        description: "The path to the directory to list",
        required: true,
      },
    },
    run: async (args: { dirpath: string }): Promise<string> => {
      try {
        if (!fs.existsSync(args.dirpath)) {
          return `Error: Directory does not exist: ${args.dirpath}`;
        }

        if (!fs.statSync(args.dirpath).isDirectory()) {
          return `Error: Path is not a directory: ${args.dirpath}`;
        }

        const files = fs.readdirSync(args.dirpath);
        const fileDetails = files.map((file) => {
          const fullPath = path.join(args.dirpath, file);
          const stats = fs.statSync(fullPath);
          const type = stats.isDirectory() ? "directory" : "file";
          const size = stats.isFile() ? `${stats.size} bytes` : "";
          return `${file} (${type}${size ? `, ${size}` : ""})`;
        });

        return `Files in ${args.dirpath}:\n${fileDetails.join("\n")}`;
      } catch (error) {
        return `Error listing files: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: "view_diff",
    description: "View all uncommitted changes in the git repository",
    parameters: {
      path: {
        type: "string",
        description:
          "The path to the git repository (defaults to current directory)",
        required: false,
      },
    },
    run: async (args: { path?: string }): Promise<string> => {
      try {
        const repoPath = args.path || process.cwd();
        if (!fs.existsSync(repoPath)) {
          return `Error: Path does not exist: ${repoPath}`;
        }

        try {
          await execPromise("git rev-parse --is-inside-work-tree", {
            cwd: repoPath,
          });
        } catch (error) {
          return `Error: The specified path is not a git repository: ${repoPath}`;
        }

        const { stdout, stderr } = await execPromise("git diff", {
          cwd: repoPath,
        });

        if (stderr) {
          return `Error executing git diff: ${stderr}`;
        }

        if (!stdout.trim()) {
          return "No changes detected in the git repository.";
        }

        return `Git diff for repository at ${repoPath}:\n\n${stdout}`;
      } catch (error) {
        return `Error running git diff: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    name: "search_code",
    description:
      "Search the codebase using ripgrep (rg) for a specific pattern",
    parameters: {
      pattern: {
        type: "string",
        description: "The search pattern to look for",
        required: true,
      },
      path: {
        type: "string",
        description: "The path to search in (defaults to current directory)",
        required: false,
      },
      file_pattern: {
        type: "string",
        description: "Optional file pattern to filter results (e.g., '*.ts')",
        required: false,
      },
    },
    run: async (args: {
      pattern: string;
      path?: string;
      file_pattern?: string;
    }): Promise<string> => {
      try {
        const searchPath = args.path || process.cwd();
        if (!fs.existsSync(searchPath)) {
          return `Error: Path does not exist: ${searchPath}`;
        }

        let command = `rg --line-number --with-filename --color never "${args.pattern}"`;

        if (args.file_pattern) {
          command += ` -g "${args.file_pattern}"`;
        }

        command += ` "${searchPath}"`;
        try {
          const { stdout, stderr } = await execPromise(command);

          if (stderr) {
            return `Warning during search: ${stderr}\n\n${stdout}`;
          }

          if (!stdout.trim()) {
            return `No matches found for pattern "${args.pattern}"${args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""}.`;
          }

          return `Search results for pattern "${args.pattern}"${args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""}:\n\n${stdout}`;
        } catch (error: any) {
          if (error.code === 1) {
            return `No matches found for pattern "${args.pattern}"${args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""}.`;
          }

          return `Error executing ripgrep: ${error instanceof Error ? error.message : String(error)}`;
        }
      } catch (error) {
        return `Error searching code: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
];

export function getToolsDescription(): string {
  return tools
    .map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(
          ([name, param]) =>
            `    "${name}": { "type": "${param.type}", "description": "${param.description}", "required": ${param.required} }`,
        )
        .join(",\n");

      return `{
  "name": "${tool.name}",
  "description": "${tool.description}",
  "parameters": {
    "type": "object",
    "properties": {
${params}
    },
    "required": [${Object.entries(tool.parameters)
      .filter(([_, param]) => param.required)
      .map(([name]) => `"${name}"`)
      .join(", ")}]
}
}`;
    })
    .join(",\n");
}

export function extractToolCalls(
  response: string,
): Array<{ name: string; arguments: Record<string, any> }> {
  const toolCallRegex = /<tool>([\s\S]*?)<\/tool>/g;
  const matches = [...response.matchAll(toolCallRegex)];

  const toolCalls = [];

  for (const match of matches) {
    try {
      const toolCallJson = JSON.parse(match[1]);
      if (toolCallJson.name && toolCallJson.arguments) {
        toolCalls.push({
          name: toolCallJson.name,
          arguments: toolCallJson.arguments,
        });
      }
    } catch (e) {
      console.error("Failed to parse tool call:", match[1]);
    }
  }

  return toolCalls;
}

export async function executeToolCall(toolCall: {
  name: string;
  arguments: Record<string, any>;
}): Promise<string> {
  const tool = tools.find((t) => t.name === toolCall.name);

  if (!tool) {
    return `Error: Tool "${toolCall.name}" not found`;
  }

  for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
    if (
      paramDef.required &&
      (toolCall.arguments[paramName] === undefined ||
        toolCall.arguments[paramName] === null)
    ) {
      return `Error: Required parameter "${paramName}" missing for tool "${toolCall.name}"`;
    }
  }

  try {
    return await tool.run(toolCall.arguments);
  } catch (error) {
    return `Error executing tool "${toolCall.name}": ${error instanceof Error ? error.message : String(error)}`;
  }
}
