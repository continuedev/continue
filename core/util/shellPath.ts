import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
    const command = `${process.env.SHELL} -l -c 'for f in ~/.zprofile ~/.zshrc ~/.bash_profile ~/.bashrc; do [ -f "$f" ] && . "$f" 2>/dev/null; done; env'`;

    const { stdout } = await execAsync(command, {
      encoding: "utf8",
    });

    return Object.fromEntries(
      stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const separatorIndex = line.indexOf("=");
          if (separatorIndex === -1) {
            return undefined;
          }

          return [
            line.slice(0, separatorIndex),
            line.slice(separatorIndex + 1),
          ] as const;
        })
        .filter(
          (entry): entry is readonly [string, string] => entry !== undefined,
        ),
    );
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
