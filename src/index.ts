#!/usr/bin/env node

import { Command } from "commander";
import { chat } from "./commands/chat.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { getVersion } from "./version.js";

const program = new Command();

program
  .name("cn")
  .description("Continue CLI - AI-powered development assistant")
  .version(getVersion());

// Root command - chat functionality (default)
program
  .argument("[prompt]", "Optional prompt to send to the assistant")
  .option("--headless", "Run in headless mode (non-interactive)")
  .option("--config <path>", "Path to configuration file")
  .option("--resume", "Resume from last session")
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

program.parse();
