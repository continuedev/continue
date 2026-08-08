import os from "os";
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import {
  evaluateTerminalCommandSecurity,
  ToolPolicy,
} from "@continuedev/terminal-security";

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

const PLATFORM_INFO = `Choose terminal commands and scripts optimized for ${os.platform()} and ${os.arch()} and shell ${getPreferredShell()}.`;

const RUN_COMMAND_NOTES = `The shell is not stateful and will not remember any previous commands.\
      When a command is run in the background ALWAYS suggest using shell commands to stop it; NEVER suggest using Ctrl+C.\
      When suggesting subsequent shell commands ALWAYS format them in shell command blocks.\
      Do NOT perform actions requiring special/admin privileges.\
      IMPORTANT: To edit files, use Edit/MultiEdit tools instead of bash commands (sed, awk, etc).\
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
          description:
            "The command to run. This will be passed directly into the IDE shell.",
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
    exampleArgs: [["command", "git log"]],
  },
};
