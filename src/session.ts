import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import { ChatCompletionMessageParam } from "openai/resources.mjs";

import { logger } from "./util/logger.js";

// List of known terminal process names
const TERMINAL_PROCESSES = [
  "Terminal",
  "iTerm",
  "tmux",
  "screen",
  "bash",
  "zsh",
  "fish",
  "kitty",
  "alacritty",
  "wt", // Windows Terminal
  "cmd", // Windows Command Prompt
  "powershell",
];

// Check if a process name looks like a terminal
function isTerminalProcess(comm: string): boolean {
  if (!comm) return false;
  return TERMINAL_PROCESSES.some((term) => comm.includes(term));
}

/**
 * Get the terminal process ID by walking up the process tree
 */
function getTerminalProcessId(): string | null {
  try {
    // Skip on Windows - ps command doesn't exist
    if (os.platform() === "win32") {
      return null;
    }

    // Get parent process info by walking up the tree
    let currentPid = process.ppid;

    for (let i = 0; i < 10 && currentPid; i++) {
      try {
        const psOutput = execSync(`ps -o pid,ppid,comm -p ${currentPid}`, {
          encoding: "utf8",
          timeout: 1000,
          stdio: ["ignore", "pipe", "ignore"], // Suppress stderr
        }).trim();

        const lines = psOutput.split("\n");
        if (lines.length < 2) break;

        const processInfo = lines[1].trim().split(/\s+/);
        const [pid, ppid, comm] = processInfo;

        // Check if this looks like a terminal process
        if (isTerminalProcess(comm)) {
          return pid;
        }

        const nextPid = parseInt(ppid);
        if (isNaN(nextPid) || nextPid <= 1) break;
        currentPid = nextPid;
      } catch {
        // Continue to next iteration if this process lookup fails
        break;
      }
    }
  } catch {
    // Silently fail - this is a fallback mechanism
  }

  return null;
}

/**
 * Get the TTY device path for unique terminal identification
 */
function getTtyPath(): string | null {
  try {
    // Skip on Windows - tty command doesn't exist
    if (os.platform() === "win32") {
      return null;
    }

    if (process.stdin.isTTY) {
      // Get the TTY device path
      const ttyPath = execSync("tty", {
        encoding: "utf8",
        timeout: 1000,
        stdio: ["ignore", "pipe", "ignore"], // Suppress stderr
      }).trim();

      if (
        ttyPath &&
        ttyPath !== "not a tty" &&
        !ttyPath.includes("not found")
      ) {
        // Convert /dev/ttys002 to ttys002 for cleaner ID
        return ttyPath.replace("/dev/", "");
      }
    }
  } catch {
    // Silently fail - this is a fallback mechanism
  }

  return null;
}

/**
 * Get a unique session identifier for the current terminal session
 * Uses environment variables to ensure each terminal window has its own session
 */
function getSessionId(): string {
  // For tests, use a specific session ID if provided
  if (process.env.CONTINUE_CLI_TEST_SESSION_ID) {
    return `continue-cli-${process.env.CONTINUE_CLI_TEST_SESSION_ID}`;
  }

  // Try environment variables first (most reliable)
  const envSession =
    process.env.TMUX_PANE ||
    process.env.TERM_SESSION_ID ||
    process.env.SSH_TTY ||
    process.env.TMUX ||
    process.env.STY;

  if (envSession) {
    const cleanSessionId = envSession.replace(/[^a-zA-Z0-9-_]/g, "-");
    return `continue-cli-${cleanSessionId}`;
  }

  // Fallback 1: Try to get TTY device path (unique per terminal window)
  const ttyPath = getTtyPath();
  if (ttyPath) {
    const cleanTtyId = ttyPath.replace(/[^a-zA-Z0-9-_]/g, "-");
    return `continue-cli-tty-${cleanTtyId}`;
  }

  // Fallback 2: Try to get terminal process ID (unique per terminal process)
  const terminalPid = getTerminalProcessId();
  if (terminalPid) {
    return `continue-cli-term-${terminalPid}`;
  }

  // Final fallback: Use process PID (least reliable but always available)
  return `continue-cli-pid-${process.pid}`;
}

/**
 * Get the session storage directory
 */
function getSessionDir(): string {
  // For tests, use the test directory if we're in test mode
  if (process.env.CONTINUE_CLI_TEST && process.env.HOME) {
    const sessionDir = path.join(process.env.HOME, ".continue-cli", "sessions");

    // Create directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    return sessionDir;
  }

  const homeDir = os.homedir();
  const sessionDir = path.join(homeDir, ".continue-cli", "sessions");

  // Create directory if it doesn't exist
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  return sessionDir;
}

/**
 * Get the session file path for the current session
 */
function getSessionFilePath(): string {
  const sessionId = getSessionId();
  const sessionDir = getSessionDir();
  return path.join(sessionDir, `${sessionId}.json`);
}

/**
 * Save chat history to session file
 */
export function saveSession(chatHistory: ChatCompletionMessageParam[]): void {
  try {
    const sessionFilePath = getSessionFilePath();
    const sessionData = {
      timestamp: new Date().toISOString(),
      chatHistory,
    };

    fs.writeFileSync(sessionFilePath, JSON.stringify(sessionData, null, 2));
  } catch (error) {
    logger.error("Error saving session:", error);
  }
}

/**
 * Load chat history from session file
 */
export function loadSession(): ChatCompletionMessageParam[] | null {
  try {
    const sessionFilePath = getSessionFilePath();

    if (!fs.existsSync(sessionFilePath)) {
      return null;
    }

    const sessionData = JSON.parse(fs.readFileSync(sessionFilePath, "utf8"));
    return sessionData.chatHistory || null;
  } catch (error) {
    logger.error("Error loading session:", error);
    return null;
  }
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  try {
    const sessionFilePath = getSessionFilePath();
    if (fs.existsSync(sessionFilePath)) {
      fs.unlinkSync(sessionFilePath);
    }
  } catch (error) {
    logger.error("Error clearing session:", error);
  }
}

/**
 * Check if a session exists for the current terminal
 */
export function hasSession(): boolean {
  const sessionFilePath = getSessionFilePath();
  return fs.existsSync(sessionFilePath);
}

/**
 * Session metadata for listing sessions
 */
export interface SessionMetadata {
  id: string; // Session ID from filename
  path: string; // Full file path
  timestamp: Date; // Last modified or session timestamp
  messageCount: number; // Total messages in session
  firstUserMessage?: string; // Preview of first user input
}

/**
 * Get metadata from a session file
 */
function getSessionMetadata(filePath: string): SessionMetadata | null {
  try {
    const fileName = path.basename(filePath, ".json");
    const stats = fs.statSync(filePath);
    const sessionData = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const chatHistory = sessionData.chatHistory || [];
    const messageCount = chatHistory.length;

    // Find the first user message
    let firstUserMessage: string | undefined;
    for (let i = 0; i < chatHistory.length; i++) {
      if (chatHistory[i].role === "user") {
        const content = chatHistory[i].content;
        // Handle both string and array content types
        if (typeof content === "string") {
          firstUserMessage = content;
        } else if (Array.isArray(content)) {
          // For array content, find the first text part
          const textPart = content.find((part) => part.type === "text");
          firstUserMessage = textPart?.text || "(multimodal message)";
        } else {
          firstUserMessage = "(unknown content type)";
        }
        break;
      }
    }

    // Use session timestamp if available, otherwise file modification time
    const timestamp = sessionData.timestamp
      ? new Date(sessionData.timestamp)
      : stats.mtime;

    return {
      id: fileName,
      path: filePath,
      timestamp,
      messageCount,
      firstUserMessage,
    };
  } catch (error) {
    logger.error(`Error reading session file ${filePath}:`, error);
    return null;
  }
}

/**
 * List all available sessions with metadata
 */
export function listSessions(limit: number = 10): SessionMetadata[] {
  try {
    const sessionDir = getSessionDir();

    if (!fs.existsSync(sessionDir)) {
      return [];
    }

    const files = fs
      .readdirSync(sessionDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(sessionDir, file));

    const sessions: SessionMetadata[] = [];

    for (const filePath of files) {
      const metadata = getSessionMetadata(filePath);
      if (metadata) {
        sessions.push(metadata);
      }
    }

    // Sort by timestamp (most recent first) and limit results
    return sessions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  } catch (error) {
    logger.error("Error listing sessions:", error);
    return [];
  }
}

/**
 * Load chat history from a specific session file
 */
export function loadSessionById(
  sessionId: string,
): ChatCompletionMessageParam[] | null {
  try {
    const sessionDir = getSessionDir();
    const sessionFilePath = path.join(sessionDir, `${sessionId}.json`);

    if (!fs.existsSync(sessionFilePath)) {
      return null;
    }

    const sessionData = JSON.parse(fs.readFileSync(sessionFilePath, "utf8"));
    return sessionData.chatHistory || null;
  } catch (error) {
    logger.error("Error loading session by ID:", error);
    return null;
  }
}
