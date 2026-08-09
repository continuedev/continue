import * as readline from "readline";

/**
 * Creates a promise-based question prompt using readline
 * Properly handles backspace and Ctrl+C
 */
export function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Handle Ctrl+C properly
    rl.on("SIGINT", () => {
      console.log("\n");
      rl.close();
      process.exit(0);
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
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
  }
}
