import {
  evaluateTerminalCommandSecurity,
  ToolPolicy,
} from "@continuedev/terminal-security";
import os from "os";
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

/**
 * Get the preferred shell for the current platform
 * @returns The preferred shell command or path
 */
function getPreferredShell(): string {
  const platform = os.platform();

  if (platform === "win32") {
    return "powershell.exe";
  } else if (platform === "darwin") {
    return process.env.SHELL || "/bin/zsh";
  } else {
    // Linux and other Unix-like systems
    return process.env.SHELL || "/bin/bash";
  }
}

/**
 * Get platform-specific command syntax guidance
 */
function getPlatformCommandGuidance(): string {
  const platform = os.platform();
  
  if (platform === "win32") {
    return `CRITICAL: Commands are executed via PowerShell. Use PowerShell syntax:
      - Multiple commands: Use semicolons (;) NOT && or ||
        Example: "cd folder; mkdir subfolder; ls"
      - Create directories: Use comma-separated list or New-Item
        Example: "mkdir dir1, dir2, dir3" or "New-Item -ItemType Directory dir1, dir2"
      - Path navigation: Both "./" and relative paths work
        Example: "cd subfolder" or "cd ./subfolder" both work
      - Environment variables: Use $env:VARIABLE
        Example: "echo $env:USERPROFILE"
      - Common aliases work: cd, ls, pwd, mkdir, rm, cp, mv
      - Native PowerShell: Get-ChildItem, New-Item, Remove-Item, Copy-Item, Move-Item
      - Redirection works: > >> < | but prefer PowerShell cmdlets for complex operations`;
  } else {
    return `Commands are executed via ${getPreferredShell()}. Use standard Unix shell syntax:
      - Multiple commands: Use && or ; for chaining
      - Paths: Use forward slashes and ./ for relative paths
      - Environment variables: Use $VARIABLE`;
  }
}

const PLATFORM_INFO = `Choose terminal commands and scripts optimized for ${os.platform()} and ${os.arch()} and shell ${getPreferredShell()}.

${getPlatformCommandGuidance()}`;

const RUN_COMMAND_NOTES = `The shell is not stateful and will not remember any previous commands.\
      When a command is run in the background ALWAYS suggest using shell commands to stop it; NEVER suggest using Ctrl+C.\
      When suggesting subsequent shell commands ALWAYS format them in shell command blocks.\
      Do NOT perform actions requiring special/admin privileges.\
      ${PLATFORM_INFO}`;

export const runTerminalCommandTool: Tool = {
  type: "function",
  displayTitle: "Run Terminal Command",
  wouldLikeTo: "run the following terminal command:",
  isCurrently: "running the following terminal command:",
  hasAlready: "ran the following terminal command:",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.RunTerminalCommand,
    description: `Run a terminal command in the current directory.\n${RUN_COMMAND_NOTES}`,
    parameters: {
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          description: os.platform() === "win32" 
            ? "The PowerShell command to run. Use PowerShell syntax (semicolons for multiple commands, comma-separated mkdir args, etc.)"
            : "The shell command to run. This will be passed directly into the shell.",
        },
        waitForCompletion: {
          type: "boolean",
          description:
            "Whether to wait for the command to complete before returning. Default is true. Set to false to run the command in the background. Set to true to run the command in the foreground and wait to collect the output.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    parsedArgs: Record<string, unknown>,
  ): ToolPolicy => {
    return evaluateTerminalCommandSecurity(
      basePolicy,
      parsedArgs.command as string,
    );
  },
  systemMessageDescription: {
    prefix: `To run a terminal command, use the ${BuiltInToolNames.RunTerminalCommand} tool
${RUN_COMMAND_NOTES}
You can also optionally include the waitForCompletion argument set to false to run the command in the background.      
For example, to see the git log, you could respond with:`,
    exampleArgs: os.platform() === "win32"
      ? [["command", "git log"], ["command", "cd src; ls; pwd"], ["command", "mkdir components, utils, types"], ["command", "Get-ChildItem -Recurse *.js"]]
      : [["command", "git log"], ["command", "cd src && ls && pwd"], ["command", "mkdir components utils types"]],
  },
};
