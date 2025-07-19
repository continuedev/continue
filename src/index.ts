#!/usr/bin/env node

import { Command } from "commander";
import { chat } from "./commands/chat.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { getVersion } from "./version.js";

// Add global error handlers to prevent uncaught errors from crashing the process
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the process, just log the error
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit the process, just log the error
});

const program = new Command();

program
  .name("cn")
  .description(
    "Continue CLI - AI-powered development assistant. Starts an interactive session by default, use -p/--print for non-interactive output."
  )
  .version(getVersion());

// Root command - chat functionality (default)
program
  .argument("[prompt]", "Optional prompt to send to the assistant")
  .option("-p, --print", "Print response and exit (useful for pipes)")
  .option("--config <path>", "Path to configuration file")
  .option("--resume", "Resume from last session")
  .option("--readonly", "Only allow readonly tools")
  .option("--no-tools", "Disable all tools")
  .option(
    "--rule <rule>",
    "Add a rule (can be a file path, hub slug, or string content). Can be specified multiple times.",
    (value: string, previous: string[] | undefined) => {
      const array = Array.isArray(previous) ? previous : [];
      array.push(value);
      return array;
    },
    [] as string[]
  )
  .action(async (prompt, options) => {
    await chat(prompt, options);
  });

// Login subcommand
program
  .command("login")
  .description("Authenticate with Continue")
  .action(async () => {
    await login();
  });

// Logout subcommand
program
  .command("logout")
  .description("Log out from Continue")
  .action(async () => {
    await logout();
  });

// Handle unknown commands
program.on("command:*", () => {
  console.error(`Error: Unknown command '${program.args.join(" ")}'\n`);
  program.outputHelp();
  process.exit(1);
});

// Parse arguments and handle errors
try {
  program.parse();
} catch (error) {
  console.error(error);
  process.exit(1);
}
