import chalk from "chalk";
import {
  getAccessToken,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "../auth/workos.js";
import { env } from "../env.js";

export async function remote(prompt: string) {
  console.info(chalk.white("Setting up remote development environment..."));

  try {
    const authConfig = loadAuthConfig();

    if (!isAuthenticatedConfig(authConfig)) {
      console.error(
        chalk.red("Not authenticated. Please run 'cn login' first.")
      );
      process.exit(1);
    }

    const accessToken = getAccessToken(authConfig);

    const response = await fetch(new URL("agents/devboxes", env.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        cUserId: authConfig.userId,
        repoUrl: "https://github.com/continuedev/amplified.dev", // getRepoUrl(),
        name: `devbox-${Date.now()}`,
        prompt: prompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create remote environment: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();

    console.info(
      chalk.green("✅ Remote development environment created successfully!")
    );

    if (result.url) {
      console.info(
        chalk.white(`Access your environment at: ${result.url}:${result.port}`)
      );
    }
  } catch (error: any) {
    console.error(
      chalk.red(`Failed to create remote environment: ${error.message}`)
    );
    process.exit(1);
  }
}
