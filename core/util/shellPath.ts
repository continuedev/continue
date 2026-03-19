import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Common Unix binary paths that should be included in PATH
const DEFAULT_UNIX_PATHS = [
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/local/sbin",
  "/usr/sbin",
  "/sbin",
  "/opt/homebrew/bin", // macOS Homebrew on Apple Silicon
  "/home/linuxbrew/.linuxbrew/bin", // Linux Homebrew
];

export async function getEnvPathFromUserShell(
  remoteName?: string,
): Promise<string | undefined> {
  const isWindowsHostWithWslRemote =
    process.platform === "win32" && remoteName === "wsl";
  if (process.platform === "win32" && !isWindowsHostWithWslRemote) {
    return undefined;
  }

  // Try to find a shell to use
  const shell = process.env.SHELL || "/bin/bash";

  try {
    // Source common profile files
    const command = `${shell} -l -c 'for f in ~/.zprofile ~/.zshrc ~/.bash_profile ~/.bashrc; do [ -f "$f" ] && source "$f" 2>/dev/null; done; echo $PATH'`;

    const { stdout } = await execAsync(command, {
      encoding: "utf8",
      timeout: 5000, // 5 second timeout
    });

    const pathFromShell = stdout.trim();
    if (pathFromShell) {
      return pathFromShell;
    }
  } catch (error) {
    // If shell command fails, fall through to default handling
    console.warn("Failed to get PATH from shell:", error);
  }

  // Fallback: build a reasonable default PATH
  if (!process.env.PATH) {
    return DEFAULT_UNIX_PATHS.join(":");
  }

  // Merge current PATH with common paths (avoiding duplicates)
  const currentPaths = process.env.PATH.split(":");
  const allPaths = [...new Set([...currentPaths, ...DEFAULT_UNIX_PATHS])];
  return allPaths.join(":");
}
