import chalk from "chalk";

import { isAuthenticated, login } from "./workos.js";

/**
 * Ensures the user is authenticated before proceeding
 * Returns true if authentication is successful, false otherwise
 */
export async function ensureAuthenticated(
  requireAuth: boolean = true,
): Promise<boolean> {
  if (await isAuthenticated()) {
    return true;
  }

  if (!requireAuth) {
    return false;
  }

  console.info(chalk.yellow("Authentication required."));

  try {
    await login();
    return true;
  } catch (error) {
    console.error(chalk.red("Failed to authenticate."), error);
    return false;
  }
}
