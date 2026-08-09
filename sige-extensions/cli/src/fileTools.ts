import * as fs from "fs";
import * as path from "path";

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Read a file and return its contents
 */
export function readFile(filePath: string): ToolResult {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        output: `Error: File does not exist: ${filePath}`,
        error: `File not found: ${filePath}`,
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return {
      success: true,
      output: `File content:\n${content}`,
    };
  } catch (error) {
    return {
      success: false,
      output: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Write content to a file
 */
export function writeFile(filePath: string, content: string): ToolResult {
  try {
    // Create directory if it doesn't exist
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content, "utf-8");
    return {
      success: true,
      output: `Successfully wrote to file: ${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      output: `Error writing to file: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List files in a directory
 */
export function listFiles(dirPath: string): ToolResult {
  try {
    if (!fs.existsSync(dirPath)) {
      return {
        success: false,
        output: `Error: Directory does not exist: ${dirPath}`,
        error: `Directory not found: ${dirPath}`,
      };
    }

    if (!fs.statSync(dirPath).isDirectory()) {
      return {
        success: false,
        output: `Error: Path is not a directory: ${dirPath}`,
        error: `Not a directory: ${dirPath}`,
      };
    }

    const files = fs.readdirSync(dirPath);
    const fileDetails = files.map((file) => {
      const fullPath = path.join(dirPath, file);
      const stats = fs.statSync(fullPath);
      const type = stats.isDirectory() ? "directory" : "file";
      const size = stats.isFile() ? `${stats.size} bytes` : "";
      return `${file} (${type}${size ? `, ${size}` : ""})`;
    });

    return {
      success: true,
      output: `Files in ${dirPath}:\n${fileDetails.join("\n")}`,
    };
  } catch (error) {
    return {
      success: false,
      output: `Error listing files: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
