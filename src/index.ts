#!/usr/bin/env node

// Add immediate logging to debug Windows CI issues
// Only log on Windows when DEBUG_CLI_TESTS is set
if (process.env.DEBUG_CLI_TESTS === "1" && process.platform === "win32") {
  console.error(
    `[CLI_START] Node ${process.version} on ${process.platform} ${process.arch}`
  );
  console.error(`[CLI_START] Args: ${JSON.stringify(process.argv)}`);
  console.error(`[CLI_START] CWD: ${process.cwd()}`);
  console.error(`[CLI_START] __dirname: ${import.meta.url}`);
}

import { Command } from "commander";
import { chat } from "./commands/chat.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { configureConsoleForHeadless } from "./util/consoleOverride.js";
import logger from "./util/logger.js";
import { getVersion } from "./version.js";

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
    // Configure console overrides FIRST, before any other logging
    const isHeadless = options.print;
    configureConsoleForHeadless(isHeadless);

    if (options.verbose) {
      logger.setLevel("debug");
      const logPath = logger.getLogPath();
      const sessionId = logger.getSessionId();
      // In headless mode, suppress these verbose logs
      if (!isHeadless) {
        console.log(`Verbose logging enabled (session: ${sessionId})`);
        console.log(`Logs: ${logPath}`);
        console.log(
          `Filter this session: grep '\\[${sessionId}\\]' ${logPath}`
        );
      }
      logger.debug("Verbose logging enabled");
    }
    // Map --print to headless mode
    options.headless = options.print;
    options.print = undefined;
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

// Wrap everything in a try-catch for Windows CI debugging
async function main() {
  try {
    await program.parseAsync();
  } catch (error: any) {
    console.error("[CLI_ERROR] Fatal error during execution:");
    console.error("[CLI_ERROR] Message:", error.message);
    console.error("[CLI_ERROR] Stack:", error.stack);
    console.error("[CLI_ERROR] Code:", error.code);

    // More specific error messages
    if (error.code === "MODULE_NOT_FOUND") {
      console.error(
        "[CLI_ERROR] Missing module. This might be a build or path issue."
      );
    }

    process.exit(1);
  }
}

// Catch any synchronous errors during startup
try {
  main().catch((error) => {
    console.error("[CLI_ERROR] Unhandled async error:", error);
    process.exit(1);
  });
} catch (error: any) {
  console.error("[CLI_ERROR] Synchronous startup error:", error);
  process.exit(1);
}
