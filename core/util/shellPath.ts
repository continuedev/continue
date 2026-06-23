import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function parseEnvEntries(entries: string[]): Record<string, string> {
  return Object.fromEntries(
    entries
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex === -1) {
          return undefined;
        }

        return [
          entry.slice(0, separatorIndex),
          entry.slice(separatorIndex + 1),
        ] as const;
      })
      .filter(
        (entry): entry is readonly [string, string] => entry !== undefined,
      ),
  );
}

async function getUserShellEnvironment(
  remoteName?: string,
): Promise<Record<string, string> | undefined> {
  const isWindowsHostWithWslRemote =
    process.platform === "win32" && remoteName === "wsl";
  if (process.platform === "win32" && !isWindowsHostWithWslRemote) {
    return undefined;
  }

  if (!process.env.SHELL) {
    return undefined;
  }

  try {
    // Source common profile files
    const command = `${process.env.SHELL} -l -c 'for f in ~/.zprofile ~/.zshrc ~/.bash_profile ~/.bashrc; do [ -f "$f" ] && . "$f" 2>/dev/null; done; if env -0 >/dev/null 2>&1; then env -0; elif printenv -0 >/dev/null 2>&1; then printenv -0; else env; fi'`;

    const { stdout } = await execAsync(command, {
      encoding: "utf8",
    });

    return stdout.includes("\0")
      ? parseEnvEntries(stdout.split("\0"))
      : parseEnvEntries(stdout.split(/\r?\n/));
  } catch (error) {
    return undefined;
  }
}

export async function getEnvVarsFromUserShell(
  remoteName?: string,
): Promise<Record<string, string> | undefined> {
  return getUserShellEnvironment(remoteName);
}

export async function getEnvPathFromUserShell(
  remoteName?: string,
): Promise<string | undefined> {
  const shellEnvironment = await getUserShellEnvironment(remoteName);
  return shellEnvironment?.PATH ?? process.env.PATH;
}
