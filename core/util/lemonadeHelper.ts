import { exec } from "node:child_process";
import { IDE } from "..";

export async function isLemonadeInstalled(): Promise<boolean> {
  return new Promise((resolve, _reject) => {
    const command =
      process.platform === "win32"
        ? "where.exe lemonade-server"
        : "which lemonade-server";
    exec(command, (error, _stdout, _stderr) => {
      resolve(!error);
    });
  });
}

export async function startLocalLemonade(ide: IDE): Promise<any> {
  let startCommand: string | undefined;

  switch (process.platform) {
    case "linux": // Linux
      startCommand = "lemonade-server run\n";
      break;

    case "win32": // Windows
      startCommand = "lemonade-server run\n";
      break;

    default:
      return ide.showToast(
        "error",
        "Cannot start Lemonade: platform not supported!",
      );
  }

  if (startCommand) {
    return ide.runCommand(startCommand, {
      reuseTerminal: true,
      terminalName: "Start Lemonade",
    });
  }
}
