import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
export async function getEnvPathFromUserShell(): Promise<string | undefined> {
  if (process.platform === "win32") {
    console.warn(`${getEnvPathFromUserShell.name} not implemented for Windows`);
    return undefined;
  }

  if (!process.env.SHELL) {
    return undefined;
  }

  try {
    // Source common profile files
    const command = `${process.env.SHELL} -l -c 'for f in ~/.zprofile ~/.zshrc ~/.bash_profile ~/.bashrc; do [ -f "$f" ] && source "$f" 2>/dev/null; done; echo $PATH'`;

    const { stdout } = await execAsync(command, {
      encoding: "utf8",
    });

    return stdout.trim();
  } catch (error) {
    return process.env.PATH; // Fallback to current PATH
  }
}
