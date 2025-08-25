import fs from "fs";
import os from "os";
import path from "path";

import { v4 as uuidv4 } from "uuid";

import type { ChatHistoryItem, Session, SessionMetadata } from "../../../core/index.js";

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
    
    const sessionFilePath = path.join(getSessionDir(), `${session.sessionId}.json`);
    
    // Write the session file
    fs.writeFileSync(sessionFilePath, JSON.stringify(session, null, 2));
    
    // Update the sessions list
    updateSessionsList(session);
  } catch (error) {
    logger.error("Error saving session:", error);
  }
}

/**
 * Update the sessions list file
 */
function updateSessionsList(session: Session): void {
  try {
    const listPath = getSessionsListPath();
    let sessions: SessionMetadata[] = [];
    
    if (fs.existsSync(listPath)) {
      const content = fs.readFileSync(listPath, 'utf8');
      try {
        sessions = JSON.parse(content);
      } catch {
        sessions = [];
      }
    }
    
    // Find or create session metadata
    const existingIndex = sessions.findIndex(s => s.sessionId === session.sessionId);
    const metadata: SessionMetadata = {
      sessionId: session.sessionId,
      title: session.title || "Untitled Session",
      dateCreated: existingIndex >= 0 ? sessions[existingIndex].dateCreated : new Date().toISOString(),
      workspaceDirectory: session.workspaceDirectory || process.cwd(),
    };
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = metadata;
    } else {
      sessions.push(metadata);
    }
    
    fs.writeFileSync(listPath, JSON.stringify(sessions, null, 2));
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

    const files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith('.json') && !f.includes('sessions-list'))
      .map(f => ({
        name: f,
        path: path.join(sessionDir, f),
        mtime: fs.statSync(path.join(sessionDir, f)).mtime
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
      const sessionFilePath = path.join(getSessionDir(), `${currentSessionId}.json`);
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
  const sessionFilePath = path.join(getSessionDir(), `${currentSessionId}.json`);
  return fs.existsSync(sessionFilePath);
}


/**
 * Get metadata from a session file with first user message preview
 */
function getSessionMetadataWithPreview(filePath: string): SessionMetadata & { firstUserMessage?: string } | null {
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
          firstUserMessage = textPart && 'text' in textPart ? textPart.text : "(multimodal message)";
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
export function listSessions(limit: number = 10): (SessionMetadata & { firstUserMessage?: string })[] {
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
      .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
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

    const session: Session = JSON.parse(fs.readFileSync(sessionFilePath, "utf8"));
    return session;
  } catch (error) {
    logger.error("Error loading session by ID:", error);
    return null;
  }
}
