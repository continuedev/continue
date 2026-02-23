import fs from "fs";
import os from "os";
import path from "path";

import type {
  BaseSessionMetadata,
  ChatHistoryItem,
  Session,
  SessionUsage,
  Usage,
} from "core/index.js";
import historyManager from "core/util/history.js";
import { v4 as uuidv4 } from "uuid";

import {
  getAccessToken,
  isAuthenticatedConfig,
  loadAuthConfig,
} from "./auth/workos.js";
import { DEFAULT_SESSION_TITLE } from "./constants/session.js";
import { env } from "./env.js";
import { logger } from "./util/logger.js";

// Re-export BaseSessionMetadata for external consumers
export type { BaseSessionMetadata };

// Extended type for sessions that can be local or remote
export interface ExtendedSessionMetadata extends BaseSessionMetadata {
  firstUserMessage?: string;
  isRemote?: boolean;
  remoteId?: string; // For remote sessions, this is the agent ID
}

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

  // Use CONTINUE_GLOBAL_DIR if set (for testing)
  const continueHome =
    process.env.CONTINUE_GLOBAL_DIR || path.join(os.homedir(), ".continue");
  const sessionDir = path.join(continueHome, "sessions");

  // Create directory if it doesn't exist
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  return sessionDir;
}

/**
 * Get the session file path for the current session
 */
export function getSessionFilePath(): string {
  const sessionId = getCurrentSessionId();
  const sessionDir = getSessionDir();
  return path.join(sessionDir, `${sessionId}.json`);
}

// Singleton for current session management
class SessionManager {
  private static instance: SessionManager;
  private currentSession: Session | null = null;
  private sessionUsage: SessionUsage = {
    totalCost: 0,
    promptTokens: 0,
    completionTokens: 0,
    promptTokensDetails: {
      cachedTokens: 0,
      cacheWriteTokens: 0,
    },
  };

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  getCurrentSession(): Session {
    if (!this.currentSession) {
      // Use test session ID for testing consistency
      const sessionId = process.env.CONTINUE_CLI_TEST_SESSION_ID
        ? process.env.CONTINUE_CLI_TEST_SESSION_ID
        : uuidv4();

      this.currentSession = {
        sessionId,
        title: DEFAULT_SESSION_TITLE,
        workspaceDirectory: process.cwd(),
        history: [],
        usage: { ...this.sessionUsage },
      };
    }
    return this.currentSession;
  }

  setSession(session: Session): void {
    this.currentSession = session;
    this.syncUsageFromSession();
  }

  updateHistory(history: ChatHistoryItem[]): void {
    const session = this.getCurrentSession();
    session.history = history;
    saveSession();
  }

  updateTitle(title: string): void {
    const session = this.getCurrentSession();
    session.title = title;
    saveSession();
  }

  clear(): void {
    this.currentSession = null;
    this.sessionUsage = {
      totalCost: 0,
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: {
        cachedTokens: 0,
        cacheWriteTokens: 0,
      },
    };
  }

  hasSession(): boolean {
    return this.currentSession !== null;
  }

  getSessionId(): string {
    return this.getCurrentSession().sessionId;
  }

  trackUsage(cost: number, usage: Usage): void {
    // Accumulate cost
    this.sessionUsage.totalCost += cost;

    // Accumulate token counts
    this.sessionUsage.promptTokens += usage.promptTokens;
    this.sessionUsage.completionTokens += usage.completionTokens;

    // Accumulate cache tokens if present
    if (usage.promptTokensDetails?.cachedTokens) {
      this.sessionUsage.promptTokensDetails =
        this.sessionUsage.promptTokensDetails || {};
      this.sessionUsage.promptTokensDetails.cachedTokens =
        (this.sessionUsage.promptTokensDetails.cachedTokens || 0) +
        usage.promptTokensDetails.cachedTokens;
    }

    if (usage.promptTokensDetails?.cacheWriteTokens) {
      this.sessionUsage.promptTokensDetails =
        this.sessionUsage.promptTokensDetails || {};
      this.sessionUsage.promptTokensDetails.cacheWriteTokens =
        (this.sessionUsage.promptTokensDetails.cacheWriteTokens || 0) +
        usage.promptTokensDetails.cacheWriteTokens;
    }

    // Update session and persist
    const session = this.getCurrentSession();
    session.usage = { ...this.sessionUsage };
    saveSession(); // Persist immediately
  }

  getTotalCost(): number {
    return this.sessionUsage.totalCost;
  }

  getUsage(): SessionUsage {
    return { ...this.sessionUsage };
  }

  private syncUsageFromSession(): void {
    const session = this.currentSession;
    if (session?.usage) {
      this.sessionUsage = { ...session.usage };
    } else {
      // Migrate old sessions that only had totalCost
      this.sessionUsage = {
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: {
          cachedTokens: 0,
          cacheWriteTokens: 0,
        },
      };
    }
  }
}

function getCurrentSessionId(): string {
  return SessionManager.getInstance().getSessionId();
}

function modifySessionBeforeSave(session: Session): Session {
  const filteredHistory = session.history.filter((item) => {
    return item.message.role !== "system";
  });

  const modifiedHistory = filteredHistory.map((item) => {
    if (item.message.role === "user") {
      return {
        ...item,
        editorState: item.message.content,
      };
    }

    return item;
  });

  return {
    ...session,
    history: modifiedHistory,
  };
}

export function getSessionPersistenceSnapshot(session: Session): Session {
  return modifySessionBeforeSave(session);
}

/**
 * Get the complete state snapshot that matches the /state endpoint format
 */
export interface StateSnapshot {
  session: Session;
  isProcessing: boolean;
  messageQueueLength: number;
  pendingPermission: any;
}

export function getCompleteStateSnapshot(
  session: Session,
  isProcessing: boolean = false,
  messageQueueLength: number = 0,
  pendingPermission: any = null,
): StateSnapshot {
  return {
    session: getSessionPersistenceSnapshot(session),
    isProcessing,
    messageQueueLength,
    pendingPermission,
  };
}

/**
 * Save the current session to file
 */
export function saveSession(): void {
  try {
    const session = SessionManager.getInstance().getCurrentSession();
    const sessionToSave = getSessionPersistenceSnapshot(session);
    historyManager.save(sessionToSave);
  } catch (error) {
    logger.error("Error saving session:", error);
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
    SessionManager.getInstance().setSession(session);
    return session;
  } catch (error) {
    logger.error("Error loading session:", error);
    return null;
  }
}

/**
 * Create a new session
 */
export function createSession(
  history: ChatHistoryItem[] = [],
  sessionId?: string,
): Session {
  const session: Session = {
    sessionId: sessionId ?? uuidv4(),
    title: DEFAULT_SESSION_TITLE,
    workspaceDirectory: process.cwd(),
    history,
    usage: {
      totalCost: 0,
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: {
        cachedTokens: 0,
        cacheWriteTokens: 0,
      },
    },
  };
  SessionManager.getInstance().setSession(session);
  return session;
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  try {
    const manager = SessionManager.getInstance();
    if (manager.hasSession()) {
      const sessionFilePath = path.join(
        getSessionDir(),
        `${manager.getSessionId()}.json`,
      );
      if (fs.existsSync(sessionFilePath)) {
        fs.unlinkSync(sessionFilePath);
      }
      manager.clear();
    }
  } catch (error) {
    logger.error("Error clearing session:", error);
  }
}

/**
 * Check if a session exists for the current terminal
 */
export function hasSession(): boolean {
  const manager = SessionManager.getInstance();
  if (!manager.hasSession()) {
    return false;
  }
  const sessionFilePath = path.join(
    getSessionDir(),
    `${manager.getSessionId()}.json`,
  );
  return fs.existsSync(sessionFilePath);
}

/**
 * Get metadata from a session file with first user message preview
 */
function getSessionMetadataWithPreview(
  filePath: string,
): ExtendedSessionMetadata | null {
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
      title: sessionData.title || DEFAULT_SESSION_TITLE,
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
 * Fetch remote agents/sessions from the API
 */
export async function getRemoteSessions(): Promise<ExtendedSessionMetadata[]> {
  try {
    const authConfig = loadAuthConfig();
    const accessToken = getAccessToken(authConfig);

    if (!accessToken || !isAuthenticatedConfig(authConfig)) {
      return [];
    }

    const response = await fetch(new URL("agents", env.apiBase), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      logger.error(`Failed to fetch remote agents: ${response.status}`);
      return [];
    }

    const agents = await response.json();

    return agents.map((agent: any) => ({
      sessionId: `remote-${agent.id}`,
      title: agent.name || "Remote Agent",
      dateCreated: new Date(agent.create_time_ms).toISOString(),
      workspaceDirectory: "",
      isRemote: true,
      remoteId: agent.id,
      firstUserMessage: "Remote agent session",
    }));
  } catch (error) {
    logger.error("Error fetching remote sessions:", error);
    return [];
  }
}

/**
 * List all available sessions with metadata (both local and remote)
 */
export async function listSessions(
  limit: number = 100,
): Promise<ExtendedSessionMetadata[]> {
  try {
    // Get local sessions
    const localSessions = historyManager.list({ limit });

    // Add first user message preview to each local session
    const localSessionsWithPreview: ExtendedSessionMetadata[] = [];

    for (const sessionMeta of localSessions) {
      const sessionFilePath = path.join(
        getSessionDir(),
        `${sessionMeta.sessionId}.json`,
      );

      if (fs.existsSync(sessionFilePath)) {
        const metadata = getSessionMetadataWithPreview(sessionFilePath);
        if (metadata) {
          localSessionsWithPreview.push({
            ...metadata,
            isRemote: false,
          });
        }
      } else {
        // Fall back to basic metadata if file doesn't exist
        localSessionsWithPreview.push({
          ...sessionMeta,
          isRemote: false,
        });
      }
    }

    // Get remote sessions
    const remoteSessions = await getRemoteSessions();

    // Combine and sort by date (most recent first)
    const allSessions = [...localSessionsWithPreview, ...remoteSessions]
      .sort(
        (a, b) =>
          new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
      )
      .slice(0, limit);

    return allSessions;
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
    const session = historyManager.load(sessionId);
    return session;
  } catch (error) {
    logger.error("Error loading session by ID:", error);
    return null;
  }
}

/**
 * Load an existing session by ID or create a new one with that ID.
 * Useful for long-lived processes (e.g., cn serve) that need to
 * preserve chat history across restarts for the same storage/agent id.
 */
export function loadOrCreateSessionById(
  sessionId: string,
  history: ChatHistoryItem[] = [],
): Session {
  const existing = loadSessionById(sessionId);
  if (existing) {
    SessionManager.getInstance().setSession(existing);
    return existing;
  }

  return createSession(history, sessionId);
}

/**
 * Update the current session's history
 */
export function updateSessionHistory(history: ChatHistoryItem[]): void {
  SessionManager.getInstance().updateHistory(history);
}

/**
 * Update the current session's title
 */
export function updateSessionTitle(title: string): void {
  SessionManager.getInstance().updateTitle(title);
}

/**
 * Get the current session
 */
export function getCurrentSession(): Session {
  return SessionManager.getInstance().getCurrentSession();
}

/**
 * Start a new session with a new sessionId
 */
export function startNewSession(history: ChatHistoryItem[] = []): Session {
  const manager = SessionManager.getInstance();

  // Clear the current session from memory (don't delete the file)
  manager.clear();

  // Create a new session with a new sessionId
  const newSession: Session = {
    sessionId: uuidv4(),
    title: DEFAULT_SESSION_TITLE,
    workspaceDirectory: process.cwd(),
    history,
    usage: {
      totalCost: 0,
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: {
        cachedTokens: 0,
        cacheWriteTokens: 0,
      },
    },
  };

  manager.setSession(newSession);
  return newSession;
}

/**
 * Track cost for the current session
 */
export function trackSessionUsage(cost: number, usage: Usage): void {
  SessionManager.getInstance().trackUsage(cost, usage);
}

/**
 * Get the total cost for the current session
 */
export function getTotalSessionCost(): number {
  return SessionManager.getInstance().getTotalCost();
}

/**
 * Get the full usage statistics for the current session
 */
export function getSessionUsage(): SessionUsage {
  return SessionManager.getInstance().getUsage();
}
