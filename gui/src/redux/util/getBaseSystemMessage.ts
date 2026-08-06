import { ModelDescription, Tool } from "core";
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";

export const NO_TOOL_WARNING =
  "\n\nTHE USER HAS NOT PROVIDED ANY TOOLS, DO NOT ATTEMPT TO USE ANY TOOLS. STOP AND LET THE USER KNOW THAT THERE ARE NO TOOLS AVAILABLE. The user can provide tools by enabling them in the Tool Policies section of the notch (wrench icon)";

/**
 * Converts a workspace directory (URI or raw path) into an LLM-friendly
 * absolute path that the filesystem tools can be pointed at.
 *
 * - file:///C:/Users/me/proj           -> C:/Users/me/proj (Windows local)
 * - file:///home/me/proj               -> /home/me/proj (POSIX local)
 * - vscode-remote://ssh-remote+host/opt -> /opt (Remote-SSH / Dev Containers)
 * - vscode-vfs://github/repo            -> /repo
 * - anything else (untitled:, empty)    -> null
 */
export function getWorkspaceDisplayPath(
  workspaceDirectory: string,
): string | null {
  if (!workspaceDirectory) {
    return null;
  }

  try {
    if (workspaceDirectory.startsWith("file://")) {
      const { pathname } = new URL(workspaceDirectory);
      const decoded = decodeURIComponent(pathname);
      // On Windows, file:///C:/... has a leading slash before the drive letter
      return /^\/[a-zA-Z]:/.test(decoded) ? decoded.slice(1) : decoded;
    }

    // Remote IDE schemes embed the remote path after the authority:
    // vscode-remote://ssh-remote+host/opt/billing -> /opt/billing
    const remotePath = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)$/.exec(
      workspaceDirectory,
    );
    if (remotePath) {
      return decodeURIComponent(remotePath[1]);
    }
  } catch {
    // Ignore malformed URIs and fall through to null
  }

  return null;
}

function workspaceInfoBlock(displayPath: string): string {
  return `\n\n<workspace_info>\nYour workspace root is: ${displayPath}\nWhen using filesystem tools, pass paths relative to this root (e.g. "src/main.ts" for ${displayPath}/src/main.ts) or absolute paths. Explore the workspace with the viewSubdirectory or ls tools instead of guessing paths.\n</workspace_info>`;
}

export function getBaseSystemMessage(
  messageMode: string,
  model: ModelDescription,
  activeTools?: Tool[],
  workspaceDirectory?: string,
): string {
  let baseMessage: string;

  if (messageMode === "agent") {
    baseMessage = model.baseAgentSystemMessage ?? DEFAULT_AGENT_SYSTEM_MESSAGE;
  } else if (messageMode === "plan") {
    baseMessage = model.basePlanSystemMessage ?? DEFAULT_PLAN_SYSTEM_MESSAGE;
  } else {
    baseMessage = model.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }

  // Add no-tools warning for agent/plan modes when no tools are available
  if (messageMode !== "chat" && (!activeTools || activeTools.length === 0)) {
    baseMessage += NO_TOOL_WARNING;
  }

  // Tell the model where the workspace root actually is. Without this, models
  // guess a workspace path (e.g. `C:\workspace`), which breaks filesystem tools
  // on remote setups like Remote-SSH or Dev Containers where the workspace is a
  // non-file:// URI. Only relevant when tools are available to use.
  if (messageMode !== "chat" && activeTools && activeTools.length > 0) {
    const displayPath = getWorkspaceDisplayPath(workspaceDirectory ?? "");
    if (displayPath) {
      baseMessage += workspaceInfoBlock(displayPath);
    }
  }

  return baseMessage;
}
