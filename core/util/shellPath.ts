import { execSync } from "child_process";

/**
 * Gets the PATH env var from the user's login shell on non-Windows platforms.
 * Windows is not implemented primarily because it is not needed at the moment.
 * @returns The enhanced PATH from the user's shell, or the current PATH if it cannot be determined
 */
export function getEnvPathFromUserShell(): string | undefined {
  if (process.platform === "win32") {
    console.warn(`${getEnvPathFromUserShell.name} not implemented for Windows`);
    return undefined;
  }

  if (!process.env.SHELL) {
    return undefined;
  }

  try {
    const command = `${process.env.SHELL} -l -c 'echo $PATH'`;

    const stdout = execSync(command, {
      encoding: "utf8",
    });

    return stdout.trim();
  } catch (error) {
    return process.env.PATH; // Fallback to current PATH
  }
}
