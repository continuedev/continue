import { execSync } from "child_process";
import { homedir } from "os";

export function getEnvPathFromUserShell(): string | undefined {
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

    const stdout = execSync(command, {
      encoding: "utf8",
    });

    return stdout.trim();
  } catch (error) {
    return process.env.PATH; // Fallback to current PATH
  }
}
