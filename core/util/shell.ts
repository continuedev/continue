import { spawnSync } from "node:child_process";
import os from "node:os";

let cachedPowerShellCommand: string | undefined;

/**
 * Get the appropriate PowerShell command for the current system.
 * Prefers 'pwsh' (PowerShell Core 6+) if available, otherwise falls back to 'powershell' (legacy).
 * This function is synchronous to support callers during module initialization.
 */
export function getPowerShellCommand(): string {
  if (os.platform() !== "win32") {
    return "pwsh";
  }

  if (cachedPowerShellCommand) {
    return cachedPowerShellCommand;
  }

  try {
    // Check if pwsh is available and get its version
    const result = spawnSync("pwsh", ["--version"], { encoding: "utf8" });
    
    // PowerShell Core version string is typically "PowerShell 7.x.x"
    if (result.status === 0 && result.stdout && result.stdout.startsWith("PowerShell")) {
      cachedPowerShellCommand = "pwsh";
    } else {
      cachedPowerShellCommand = "powershell";
    }
  } catch (error) {
    // If pwsh fails to execute, fall back to powershell
    cachedPowerShellCommand = "powershell";
  }

  return cachedPowerShellCommand;
}
