import fs from "fs";
import os from "os";
import path from "path";

import { v4 as uuidv4 } from "uuid";

import type {
  ChatHistoryItem,
  Session,
  SessionMetadata,
} from "../../../core/index.js";

// Re-export SessionMetadata for external consumers
export type { SessionMetadata };

import { logger } from "./util/logger.js";

// Note: We now use UUID-based session IDs instead of terminal-based IDs.
// Each new chat session gets a unique UUID.
// The --resume flag loads the most recent session.

/**
 * Get the session storage directory
 */
function getSessionDir(): string {
  // For tests, use the test directory if we're in test mode
  if (process.env.CONTINUE_CLI_TEST && process.env.HOME) {
    const sessionDir = path.join(process.env.HOME, ".continue", "sessions");

    // Create directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    return sessionDir;
  }

  const homeDir = os.homedir();
  const sessionDir = path.join(homeDir, ".continue", "sessions");

  // Create directory if it doesn't exist
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  return sessionDir;
}

/**
 * Get the sessions list file path
 */
function getSessionsListPath(): string {
  const sessionDir = getSessionDir();
  const listPath = path.join(sessionDir, "sessions.json");

  // Initialize with empty array if doesn't exist
  if (!fs.existsSync(listPath)) {
    fs.writeFileSync(listPath, JSON.stringify([]));
  }

  return listPath;
}

/**
 * Get the session file path for the current session
 */
export function getSessionFilePath(): string {
  const sessionId = getCurrentSessionId();
  const sessionDir = getSessionDir();
  return path.join(sessionDir, `${sessionId}.json`);
}

// Store the current session ID for the terminal
let currentSessionId: string | null = null;

/**
 * Get or create a session ID for the current terminal
 */
function getCurrentSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = uuidv4();
  }
  return currentSessionId;
}

/**
 * Save session to file
 */
export function saveSession(session: Session): void {
  try {
    // Store the session ID for future reference
    currentSessionId = session.sessionId;

    // Filter out system messages except for the first one
    // TODO: Properly handle system messages vs informational messages in the future
    const filteredHistory = session.history.filter((item, index) => {
      return index === 0 || item.message.role !== "system";
    });

    const sessionToSave: Session = {
      ...session,
      history: filteredHistory,
    };

    const sessionFilePath = path.join(
      getSessionDir(),
      `${session.sessionId}.json`,
    );

    // Write the session file
    fs.writeFileSync(sessionFilePath, JSON.stringify(sessionToSave, null, 2));

    // Update the sessions list
    updateSessionsList(sessionToSave);
  } catch (error) {
    logger.error("Error saving session:", error);
  }
}

/**
 * Update the sessions list file
 */
function updateSessionsList(session: Session): void {
  try {
    const sessionsListFilePath = getSessionsListPath();

    // Read and update the sessions list (following core/util/history.ts pattern)
    try {
      const rawSessionsList = fs.readFileSync(sessionsListFilePath, "utf-8");

      let sessionsList: SessionMetadata[];
      try {
        sessionsList = JSON.parse(rawSessionsList);
      } catch (e) {
        if (rawSessionsList.trim() === "") {
          fs.writeFileSync(sessionsListFilePath, JSON.stringify([]));
          sessionsList = [];
        } else {
          throw e;
        }
      }

      // Filter out old format sessions (safety measure)
      sessionsList = sessionsList.filter((sessionItem: any) => {
        return typeof sessionItem.session_id !== "string";
      });

      let found = false;
      for (const sessionMetadata of sessionsList) {
        if (sessionMetadata.sessionId === session.sessionId) {
          sessionMetadata.title = session.title || "Untitled Session";
          sessionMetadata.workspaceDirectory =
            session.workspaceDirectory || process.cwd();
          found = true;
          break;
        }
      }

      if (!found) {
        const sessionMetadata: SessionMetadata = {
          sessionId: session.sessionId,
          title: session.title || "Untitled Session",
          dateCreated: new Date().toISOString(),
          workspaceDirectory: session.workspaceDirectory || process.cwd(),
        };
        sessionsList.push(sessionMetadata);
      }

      fs.writeFileSync(
        sessionsListFilePath,
        JSON.stringify(sessionsList, undefined, 2),
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          `It looks like there is a JSON formatting error in your sessions.json file (${sessionsListFilePath}). Please fix this before creating a new session.`,
        );
      }
      throw new Error(
        `It looks like there is a validation error in your sessions.json file (${sessionsListFilePath}). Please fix this before creating a new session. Error: ${error}`,
      );
    }
  } catch (error) {
    logger.error("Error updating sessions list:", error);
  }
}

/**
 * Load session from current terminal's session file
 */
export function loadSession(): Session | null {
  try {
    // For resume, we need to find the most recent session
    const sessionDir = getSessionDir();
    if (!fs.existsSync(sessionDir)) {
      return null;
    }

    const files = fs
      .readdirSync(sessionDir)
      .filter((f) => f.endsWith(".json") && f !== "sessions.json")
      .map((f) => ({
        name: f,
        path: path.join(sessionDir, f),
        mtime: fs.statSync(path.join(sessionDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length === 0) {
      return null;
    }

    // Load the most recent session
    const session: Session = JSON.parse(fs.readFileSync(files[0].path, "utf8"));
    // Set this as the current session for future saves
    currentSessionId = session.sessionId;
    return session;
  } catch (error) {
    logger.error("Error loading session:", error);
    return null;
  }
}

/**
 * Create a new session
 */
export function createSession(history: ChatHistoryItem[] = []): Session {
  const sessionId = uuidv4();
  currentSessionId = sessionId; // Store for future reference
  return {
    sessionId,
    title: "Untitled Session",
    workspaceDirectory: process.cwd(),
    history,
  };
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  try {
    if (currentSessionId) {
      const sessionFilePath = path.join(
        getSessionDir(),
        `${currentSessionId}.json`,
      );
      if (fs.existsSync(sessionFilePath)) {
        fs.unlinkSync(sessionFilePath);
      }
      currentSessionId = null;
    }
  } catch (error) {
    logger.error("Error clearing session:", error);
  }
}

/**
 * Check if a session exists for the current terminal
 */
export function hasSession(): boolean {
  if (!currentSessionId) {
    return false;
  }
  const sessionFilePath = path.join(
    getSessionDir(),
    `${currentSessionId}.json`,
  );
  return fs.existsSync(sessionFilePath);
}

/**
 * Get metadata from a session file with first user message preview
 */
function getSessionMetadataWithPreview(
  filePath: string,
): (SessionMetadata & { firstUserMessage?: string }) | null {
  try {
    const sessionData: Session = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const stats = fs.statSync(filePath);

    // Find the first user message for preview
    let firstUserMessage: string | undefined;
    for (const item of sessionData.history || []) {
      if (item.message.role === "user") {
        const content = item.message.content;
        // Handle both string and array content types
        if (typeof content === "string") {
          firstUserMessage = content;
        } else if (Array.isArray(content)) {
          // For array content, find the first text part
          const textPart = content.find((part) => part.type === "text");
          firstUserMessage =
            textPart && "text" in textPart
              ? textPart.text
              : "(multimodal message)";
        } else {
          firstUserMessage = "(unknown content type)";
        }
        break;
      }
    }

    return {
      sessionId: sessionData.sessionId,
      title: sessionData.title || "Untitled Session",
      dateCreated: stats.birthtime.toISOString(),
      workspaceDirectory: sessionData.workspaceDirectory || "",
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
export function listSessions(
  limit: number = 10,
): (SessionMetadata & { firstUserMessage?: string })[] {
  try {
    const sessionDir = getSessionDir();

    if (!fs.existsSync(sessionDir)) {
      return [];
    }

    const files = fs
      .readdirSync(sessionDir)
      .filter((file) => file.endsWith(".json") && file !== "sessions.json")
      .map((file) => path.join(sessionDir, file));

    const sessions: (SessionMetadata & { firstUserMessage?: string })[] = [];

    for (const filePath of files) {
      const metadata = getSessionMetadataWithPreview(filePath);
      if (metadata) {
        sessions.push(metadata);
      }
    }

    // Sort by date created (most recent first) and limit results
    return sessions
      .sort(
        (a, b) =>
          new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
      )
      .slice(0, limit);
  } catch (error) {
    logger.error("Error listing sessions:", error);
    return [];
  }
}

/**
 * Load session by ID
 */
export function loadSessionById(sessionId: string): Session | null {
  try {
    const sessionDir = getSessionDir();
    const sessionFilePath = path.join(sessionDir, `${sessionId}.json`);

    if (!fs.existsSync(sessionFilePath)) {
      return null;
    }

    const session: Session = JSON.parse(
      fs.readFileSync(sessionFilePath, "utf8"),
    );
    return session;
  } catch (error) {
    logger.error("Error loading session by ID:", error);
    return null;
  }
}
