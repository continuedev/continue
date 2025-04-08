import chalk from "chalk";
import { isAuthenticated, loginWithMagicAuth } from "./workos.js";

/**
 * Ensures the user is authenticated before proceeding
 * Returns true if authentication is successful, false otherwise
 */
export async function ensureAuthenticated(
  requireAuth: boolean = true,
): Promise<boolean> {
  if (isAuthenticated()) {
    return true;
  }

  if (!requireAuth) {
    return false;
  }

  console.log(chalk.yellow("Authentication required."));

  try {
    await loginWithMagicAuth();
    return true;
  } catch (error) {
    console.error(chalk.red("Failed to authenticate."));
    return false;
  }
}
