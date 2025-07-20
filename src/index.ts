#!/usr/bin/env node

import { Command } from "commander";
import { chat } from "./commands/chat.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { getVersion } from "./version.js";
import logger from "./util/logger.js";
import { safeExit } from "./util/exit-handler.js";

// Add global error handlers to prevent uncaught errors from crashing the process
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
  // Don't exit the process, just log the error
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
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
  .option("-v, --verbose", "Enable verbose logging")
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
    if (options.verbose) {
      logger.setLevel('debug');
      const logPath = logger.getLogPath();
      const sessionId = logger.getSessionId();
      console.log(`Verbose logging enabled (session: ${sessionId})`);
      console.log(`Logs: ${logPath}`);
      console.log(`Filter this session: grep '\\[${sessionId}\\]' ${logPath}`);
      logger.debug('Verbose logging enabled');
    }
    // Map CLI options to chat options
    const chatOptions = {
      ...options,
      headless: options.print, // Map --print to headless mode
    };
    await chat(prompt, chatOptions);
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
program.on("command:*", async () => {
  console.error(`Error: Unknown command '${program.args.join(" ")}'\n`);
  program.outputHelp();
  await safeExit(1);
});

// Parse arguments and handle errors
try {
  program.parse();
} catch (error) {
  console.error(error);
  await safeExit(1);
}
