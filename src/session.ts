import { ChatCompletionMessageParam } from "openai/resources.mjs";
import fs from "fs";
import path from "path";
import os from "os";
import logger from "./util/logger.js";

/**
 * Get a unique session identifier for the current terminal session
 * Uses environment variables to ensure each terminal window has its own session
 */
function getSessionId(): string {
  // Use a combination of terminal session ID and process ID to ensure uniqueness
  // For tmux, use TMUX_PANE which is unique per pane
  const terminalSession = process.env.TMUX_PANE || 
                          process.env.TERM_SESSION_ID || 
                          process.env.SSH_TTY || 
                          process.env.TMUX || 
                          process.env.STY || 
                          process.pid.toString();
  
  // Clean up the session ID to be filesystem-safe
  const cleanSessionId = terminalSession.replace(/[^a-zA-Z0-9-_]/g, '-');
  
  return `continue-cli-${cleanSessionId}`;
}

/**
 * Get the session storage directory
 */
function getSessionDir(): string {
  const homeDir = os.homedir();
  const sessionDir = path.join(homeDir, '.continue-cli', 'sessions');
  
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
      chatHistory
    };
    
    fs.writeFileSync(sessionFilePath, JSON.stringify(sessionData, null, 2));
  } catch (error) {
    logger.error('Error saving session:', error);
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
    
    const sessionData = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
    return sessionData.chatHistory || null;
  } catch (error) {
    logger.error('Error loading session:', error);
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
    logger.error('Error clearing session:', error);
  }
}

/**
 * Check if a session exists for the current terminal
 */
export function hasSession(): boolean {
  const sessionFilePath = getSessionFilePath();
  return fs.existsSync(sessionFilePath);
}