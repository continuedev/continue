import chalk from "chalk";

import { login as workosLogin } from "../auth/workos.js";
import { gracefulExit } from "../util/exit.js";

export async function login() {
  console.info(chalk.yellow("Logging in to Continue..."));

  try {
    await workosLogin();
    console.info(chalk.green("Successfully logged in!"));
  } catch (error: any) {
    console.error(chalk.red(`Login failed: ${error.message}`));
    await gracefulExit(1);
  }
}
