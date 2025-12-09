import path from "path";

import { diffLines } from "diff";

/**
 * Calculate lines of code added/removed from a file diff
 */
export function calculateLinesOfCodeDiff(
  oldContent: string,
  newContent: string,
): { added: number; removed: number } {
  const diff = diffLines(oldContent, newContent);
  let added = 0;
  let removed = 0;

  for (const part of diff) {
    if (part.added) {
      added += part.count || 0;
    } else if (part.removed) {
      removed += part.count || 0;
    }
  }

  return { added, removed };
}

/**
 * Extract programming language from file path
 */
export function getLanguageFromFilePath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const languageMap: Record<string, string> = {
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".py": "Python",
    ".java": "Java",
    ".cpp": "C++",
    ".c": "C",
    ".cs": "C#",
    ".php": "PHP",
    ".rb": "Ruby",
    ".go": "Go",
    ".rs": "Rust",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".scala": "Scala",
    ".clj": "Clojure",
    ".hs": "Haskell",
    ".ml": "OCaml",
    ".elm": "Elm",
    ".dart": "Dart",
    ".lua": "Lua",
    ".r": "R",
    ".m": "Objective-C",
    ".mm": "Objective-C++",
    ".sh": "Shell",
    ".bash": "Bash",
    ".zsh": "Zsh",
    ".fish": "Fish",
    ".ps1": "PowerShell",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".less": "Less",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".md": "Markdown",
    ".json": "JSON",
    ".xml": "XML",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".ini": "INI",
    ".cfg": "Config",
    ".conf": "Config",
    ".sql": "SQL",
    ".dockerfile": "Dockerfile",
  };

  return languageMap[ext] || "unknown";
}

/**
 * Extract the first word (command type) from a shell command
 */
export function extractCommandType(command: string): string {
  return command.trim().split(/\s+/)[0] || "unknown";
}

/**
 * Check if a command is a git commit command
 */
export function isGitCommitCommand(command: string): boolean {
  const trimmed = command.trim().toLowerCase();
  return trimmed.startsWith("git commit") || trimmed.startsWith("git-commit");
}

/**
 * Check if a command is a pull request creation command
 */
export function isPullRequestCommand(command: string): boolean {
  const trimmed = command.trim().toLowerCase();
  return (
    trimmed.includes("gh pr create") ||
    (trimmed.includes("git push") && trimmed.includes("pull-request")) ||
    trimmed.includes("hub pull-request") ||
    trimmed.includes("gitlab mr create")
  );
}

/**
 * Get file type from extension for metrics
 */
export function getFileTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext.startsWith(".") ? ext.substring(1) : "unknown";
}
