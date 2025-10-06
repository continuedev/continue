import { render } from "ink";
import React from "react";

import { listSessions, loadSessionById } from "../session.js";
import { SessionSelector } from "../ui/SessionSelector.js";
import { ApiRequestError, post } from "../util/apiClient.js";
import { logger } from "../util/logger.js";

import { chat } from "./chat.js";
import { remote } from "./remote.js";

interface ListSessionsOptions {
  format?: "json";
}

/**
 * Set a specific session ID for the current process
 * This allows us to load a selected session as if it were the current session
 */
function setSessionId(sessionId: string): void {
  // Use the same environment variable that getSessionId() checks
  process.env.CONTINUE_CLI_TEST_SESSION_ID = sessionId.replace(
    "continue-cli-",
    "",
  );
}

export async function getTunnelForAgent(agentId: string): Promise<string> {
  try {
    const response = await post<{ url: string }>(
      `agents/${encodeURIComponent(agentId)}/tunnel`,
    );
    return response.data.url;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new Error(
        `Failed to get tunnel for agent ${agentId}: ${error.response || error.statusText}`,
      );
    }
    throw error;
  }
}

/**
 * List recent chat sessions and allow selection
 */
export async function listSessionsCommand(
  options: ListSessionsOptions = {},
): Promise<void> {
  // Handle JSON format output first
  if (options.format === "json") {
    const sessions = await listSessions();
    console.log(
      JSON.stringify(
        {
          sessions: sessions.map((session) => ({
            id: session.sessionId,
            timestamp: session.dateCreated,
            workspaceDirectory: session.workspaceDirectory,
            title: session.title,
            firstUserMessage: session.firstUserMessage,
            isRemote: session.isRemote,
            remoteId: session.remoteId,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  // For TUI mode, fetch more sessions than we might display so the UI can choose based on screen height
  const sessions = await listSessions();

  // Handle empty sessions case
  if (sessions.length === 0) {
    console.log(
      "No previous sessions found. Start a new conversation with: cn",
    );
    return;
  }

  // Start TUI selector
  return new Promise<void>((resolve, reject) => {
    const handleSelect = async (sessionId: string) => {
      try {
        app.unmount();

        // Find the selected session to check if it's remote
        const selectedSession = sessions.find((s) => s.sessionId === sessionId);

        if (selectedSession?.isRemote && selectedSession.remoteId) {
          // Handle remote session - use the remote command with the agent URL
          logger.info(`Opening remote session: ${selectedSession.remoteId}`);

          const tunnelUrl = await getTunnelForAgent(selectedSession.remoteId);

          await remote(undefined, { url: tunnelUrl });
        } else {
          // Handle local session
          const sessionHistory = loadSessionById(sessionId);
          if (!sessionHistory) {
            logger.error(`Session ${sessionId} could not be loaded.`);
            resolve();
            return;
          }

          logger.info(`Loading session: ${sessionId}`);

          // Set the session ID so that when chat() runs, it will load this session
          setSessionId(sessionId);

          // Start chat with resume flag to load the selected session
          await chat(undefined, {
            resume: true,
            headless: false,
          });
        }

        resolve();
      } catch (error) {
        logger.error("Error loading session:", error);
        reject(error);
      }
    };

    const handleExit = () => {
      app.unmount();
      resolve();
    };

    const app = render(
      React.createElement(SessionSelector, {
        sessions,
        onSelect: handleSelect,
        onExit: handleExit,
      }),
    );
  });
}
