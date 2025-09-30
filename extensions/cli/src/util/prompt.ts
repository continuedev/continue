import * as readline from "readline";

/**
 * Creates a promise-based question prompt using readline
 * Properly handles backspace and Ctrl+C
 */
export function question(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Store existing SIGINT listeners to restore them later
    const existingSigintListeners = process.listeners("SIGINT").slice();

    // Remove existing SIGINT listeners to avoid conflicts
    process.removeAllListeners("SIGINT");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const cleanup = () => {
      rl.close();
      // Restore original SIGINT listeners
      process.removeAllListeners("SIGINT");
      existingSigintListeners.forEach((listener) => {
        process.on("SIGINT", listener as (...args: any[]) => void);
      });
    };

    // Handle Ctrl+C properly
    rl.on("SIGINT", () => {
      console.log("\n");
      cleanup();
      process.exit(0);
    });

    rl.question(prompt, (answer) => {
      cleanup();
      resolve(answer);
    });

    // Handle any errors
    rl.on("error", (error) => {
      cleanup();
      reject(error);
    });
  });
}

/**
 * Creates a prompt with limited choices
 * @param prompt The prompt to display
 * @param choices Array of valid choices
 * @param defaultChoice Default choice if user presses enter
 * @param limitMessage Message to show when invalid choice is entered
 */
export async function questionWithChoices(
  prompt: string,
  choices: string[],
  defaultChoice?: string,
  limitMessage?: string,
): Promise<string> {
  while (true) {
    try {
      const answer = await question(prompt);

      // Handle default choice
      if (answer === "" && defaultChoice !== undefined) {
        return defaultChoice;
      }

      // Check if answer is valid
      if (choices.includes(answer)) {
        return answer;
      }

      // Show limit message if provided
      if (limitMessage) {
        console.log(limitMessage);
      }
    } catch (error) {
      // If question was interrupted (e.g., Ctrl+C), re-throw the error
      throw error;
    }
  }
}
