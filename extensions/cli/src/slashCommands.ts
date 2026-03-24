import fs from "fs";

import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";
import type { Session } from "core/index.js";
import historyManager from "core/util/history.js";
import { v4 as uuidv4 } from "uuid";

import {
  isAuthenticated,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "./auth/workos.js";
import { getAllSlashCommands } from "./commands/commands.js";
import { handleInit } from "./commands/init.js";
import { handleInfoSlashCommand } from "./infoScreen.js";
import { reloadService, SERVICE_NAMES, services } from "./services/index.js";
import { getCurrentSession, updateSessionTitle } from "./session.js";
import { posthogService } from "./telemetry/posthogService.js";
import { telemetryService } from "./telemetry/telemetryService.js";
import { buildImportSkillPrompt } from "./tools/skills.js";
import { SlashCommandResult } from "./ui/hooks/useChat.types.js";
import {
  getSkillSlashCommandName,
  loadMarkdownSkills,
} from "./util/loadMarkdownSkills.js";

type CommandHandler = (
  args: string[],
  assistant: AssistantConfig,
  remoteUrl?: string,
  options?: { isRemoteMode?: boolean },
) => Promise<SlashCommandResult> | SlashCommandResult;

async function handleHelp(_args: string[], _assistant: AssistantConfig) {
  const helpMessage = [
    chalk.bold("Keyboard Shortcuts:"),
    "",
    chalk.white("Navigation:"),
    `  ${chalk.cyan("↑/↓")}        Navigate command/file suggestions or history`,
    `  ${chalk.cyan("Tab")}        Complete command or file selection`,
    `  ${chalk.cyan("Enter")}      Submit message`,
    `  ${chalk.cyan("Shift+Enter")} New line`,
    `  ${chalk.cyan("\\")}          Line continuation (at end of line)`,
    `  ${chalk.cyan("!")}          Shell mode - run shell commands`,
    "",
    chalk.white("Controls:"),
    `  ${chalk.cyan("Ctrl+C")}     Clear input`,
    `  ${chalk.cyan("Ctrl+D")}     Exit application`,
    `  ${chalk.cyan("Ctrl+L")}     Clear screen`,
    `  ${chalk.cyan("Shift+Tab")}  Cycle permission modes (normal/plan/auto)`,
    `  ${chalk.cyan("Esc")}        Cancel streaming or close suggestions`,
    "",
    chalk.white("Special Characters:"),
    `  ${chalk.cyan("@")}          Search and attach files for context`,
    `  ${chalk.cyan("/")}          Access slash commands`,
    `  ${chalk.cyan("!")}          Execute bash commands directly`,
    "",
    chalk.white("Available Commands:"),
    `  Type ${chalk.cyan("/")} to see available slash commands`,
    `  Type ${chalk.cyan("!")} followed by a command to execute bash directly`,
  ].join("\n");
  return { output: helpMessage };
}

async function handleLogin() {
  try {
    const newAuthState = await services.auth.login();
    await reloadService(SERVICE_NAMES.AUTH);

    const userInfo =
      newAuthState.authConfig && isAuthenticatedConfig(newAuthState.authConfig)
        ? newAuthState.authConfig.userEmail || newAuthState.authConfig.userId
        : "user";

    console.info(chalk.green(`\nLogged in as ${userInfo}`));

    return {
      exit: false,
      output: "Login successful! All services updated automatically.",
    };
  } catch (error: any) {
    console.error(chalk.red(`\nLogin failed: ${error.message}`));
    return {
      exit: false,
      output: `Login failed: ${error.message}`,
    };
  }
}

async function handleLogout() {
  try {
    await services.auth.logout();
    return {
      exit: true,
      output: "Logged out successfully",
    };
  } catch {
    return {
      exit: true,
      output: "Logged out successfully",
    };
  }
}

async function handleWhoami() {
  const authed = await isAuthenticated();
  if (authed) {
    const config = loadAuthConfig(); // TODO duplicate auth config loading
    if (config && isAuthenticatedConfig(config)) {
      return {
        exit: false,
        output: `Logged in as ${config.userEmail || config.userId}`,
      };
    } else {
      return {
        exit: false,
        output: "Authenticated via environment variable",
      };
    }
  } else {
    return {
      exit: false,
      output: "Not logged in. Use /login to authenticate.",
    };
  }
}

async function handleFork() {
  try {
    const currentSession = getCurrentSession();
    const forkCommand = `cn --fork ${currentSession.sessionId}`;
    // Try to copy to clipboard dynamically to avoid hard dependency in tests
    try {
      const clipboardy = await import("clipboardy");
      await clipboardy.default.write(forkCommand);
      return {
        exit: false,
        output: chalk.gray(`${forkCommand} (copied to clipboard)`),
      };
    } catch {
      return {
        exit: false,
        output: chalk.gray(`${forkCommand}`),
      };
    }
  } catch (error: any) {
    return {
      exit: false,
      output: chalk.red(`Failed to create fork command: ${error.message}`),
    };
  }
}

function handleTitle(args: string[]) {
  const title = args.join(" ").trim();
  if (!title) {
    return {
      exit: false,
      output: chalk.yellow(
        "Please provide a title. Usage: /title <your title>",
      ),
    };
  }

  try {
    updateSessionTitle(title);
    return {
      exit: false,
      output: chalk.green(`Session title updated to: "${title}"`),
    };
  } catch (error: any) {
    return {
      exit: false,
      output: chalk.red(`Failed to update title: ${error.message}`),
    };
  }
}

function handleJobs() {
  return { openJobsSelector: true };
}

async function handleSkills(): Promise<SlashCommandResult> {
  const { skills } = await loadMarkdownSkills();

  if (!skills.length) {
    return {
      exit: false,
      output: chalk.yellow(
        "No skills found. Add skills under .continue/skills or .claude/skills.",
      ),
    };
  }

  const header = chalk.bold("Available skills:");
  const lines = skills.map(
    (skill) =>
      `${chalk.cyan(skill.name)} - ${skill.description} ${chalk.gray(
        `(${skill.path})`,
      )}`,
  );

  return {
    exit: false,
    output: [header, "", ...lines].join("\n"),
  };
}

async function handleImportSkill(args: string[]): Promise<SlashCommandResult> {
  const query = args.join(" ").trim();

  if (!query) {
    return {
      exit: false,
      output: chalk.yellow(
        "Please provide a skill URL or name. Usage: /import-skill <url-or-name>",
      ),
    };
  }

  return {
    newInput: buildImportSkillPrompt(query),
  };
}

function handleSessions() {
  return { openSessionSelector: true };
}

const EXPORTED_SESSION_VERSION = 1;

interface ExportedSession {
  version: number;
  exportedAt: string;
  session: Session;
}

function isValidExportedSession(data: unknown): data is ExportedSession {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    obj.version === EXPORTED_SESSION_VERSION &&
    typeof obj.exportedAt === "string" &&
    typeof obj.session === "object" &&
    obj.session !== null &&
    typeof (obj.session as Record<string, unknown>).sessionId === "string" &&
    typeof (obj.session as Record<string, unknown>).title === "string" &&
    Array.isArray((obj.session as Record<string, unknown>).history)
  );
}

function handleExport(_args: string[]): SlashCommandResult {
  posthogService.capture("useSlashCommand", { name: "export" });

  return {
    exit: false,
    openExportSelector: true,
  };
}

function handleImport(args: string[]): SlashCommandResult {
  posthogService.capture("useSlashCommand", { name: "import" });

  const filePath = args.join(" ").trim();
  if (!filePath) {
    return {
      exit: false,
      output: chalk.yellow(
        "Please provide a file path. Usage: /import <file-path>",
      ),
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      exit: false,
      output: chalk.red(`File not found: ${filePath}`),
    };
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const exportedData: unknown = JSON.parse(fileContent);

    if (!isValidExportedSession(exportedData)) {
      return {
        exit: false,
        output: chalk.red(
          "Invalid session file: expected a valid Continue exported session (version 1).",
        ),
      };
    }

    let session = exportedData.session;

    const existing = historyManager.load(session.sessionId);
    const sessionExists = existing.history.length > 0;

    if (sessionExists) {
      const originalId = session.sessionId;
      session = {
        ...session,
        sessionId: uuidv4(),
      };
      historyManager.save(session);
      return {
        exit: false,
        output: chalk.green(
          `Session imported with new ID: ${session.sessionId}\n` +
            chalk.gray(`(original ID: ${originalId} already existed)`),
        ),
      };
    }

    historyManager.save(session);
    return {
      exit: false,
      output: chalk.green(
        `Session imported: ${session.sessionId} (${session.title})`,
      ),
    };
  } catch (error: any) {
    return {
      exit: false,
      output: chalk.red(`Failed to import session: ${error.message}`),
    };
  }
}

const commandHandlers: Record<string, CommandHandler> = {
  help: handleHelp,
  clear: () => {
    return { clear: true, output: "Chat history cleared" };
  },
  exit: () => {
    return { exit: true, output: "Goodbye!" };
  },
  config: () => {
    return { openConfigSelector: true };
  },
  login: handleLogin,
  logout: handleLogout,
  whoami: handleWhoami,
  info: handleInfoSlashCommand,
  model: () => ({ openModelSelector: true }),
  compact: () => {
    return { compact: true };
  },
  mcp: () => {
    return { openMcpSelector: true };
  },
  resume: () => {
    return { openSessionSelector: true };
  },
  fork: handleFork,
  title: handleTitle,
  rename: handleTitle,
  init: (args, assistant) => {
    return handleInit(args, assistant);
  },
  update: () => {
    return { openUpdateSelector: true };
  },
  jobs: handleJobs,
  skills: () => handleSkills(),
  "import-skill": (args) => handleImportSkill(args),
  sessions: handleSessions,
  export: handleExport,
  import: handleImport,
};

export async function handleSlashCommands(
  input: string,
  assistant: AssistantConfig,
  options?: { remoteUrl?: string; isRemoteMode?: boolean },
): Promise<SlashCommandResult | null> {
  // Only trigger slash commands if slash is the very first character
  if (!input.startsWith("/") || !input.trim().startsWith("/")) {
    return null;
  }

  const [command, ...args] = input.slice(1).split(" ");

  telemetryService.recordSlashCommand(command);
  posthogService.capture("useSlashCommand", { name: command });

  const handler = commandHandlers[command];
  if (handler) {
    return await handler(args, assistant, options?.remoteUrl, options);
  }

  // Check for custom assistant prompts
  const assistantPrompt = assistant.prompts?.find(
    (prompt) => prompt?.name === command,
  );
  if (assistantPrompt) {
    const newInput = assistantPrompt.prompt + args.join(" ");
    return { newInput };
  }

  // Check for invokable rules
  const invokableRule = assistant.rules?.find((rule) => {
    // Handle both string rules and rule objects
    if (!rule || typeof rule === "string") {
      return false;
    }
    const ruleObj = rule as any;
    return ruleObj.invokable === true && ruleObj.name === command;
  });
  if (invokableRule) {
    const ruleObj = invokableRule as any;
    const newInput = ruleObj.rule + " " + args.join(" ");
    return { newInput };
  }

  const { skills } = await loadMarkdownSkills();
  if (skills.length) {
    const normalizedCommand = command.trim().toLowerCase();
    const matchingSkill = skills.find(
      (skill) => getSkillSlashCommandName(skill) === normalizedCommand,
    );

    if (matchingSkill) {
      return {
        newInput: `Load the skill using the **Skills** tool and then set the **skill_name** parameter to "${matchingSkill.name}".`,
      };
    }
  }

  // Check if this command would match any available commands (same logic as UI)
  const allCommands = await getAllSlashCommands(assistant, {
    isRemoteMode: options?.isRemoteMode,
  });
  const hasMatches = allCommands.some((cmd) =>
    cmd.name.toLowerCase().includes(command.toLowerCase()),
  );

  // If no commands match, treat this as regular text instead of an unknown command
  if (!hasMatches) {
    return null;
  }

  return { output: `Unknown command: ${command}` };
}
