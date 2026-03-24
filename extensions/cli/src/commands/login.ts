import chalk from "chalk";

import { gracefulExit } from "../util/exit.js";

export async function login() {
  console.error(
    chalk.red("Login is not available. Hub authentication has been removed."),
  );
  await gracefulExit(1);
}
