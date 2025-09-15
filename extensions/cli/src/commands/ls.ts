import { render } from "ink";
import React from "react";

import { loadSessionById, listSessions } from "../session.js";
import { SessionSelector } from "../ui/SessionSelector.js";
import { logger } from "../util/logger.js";

import { chat } from "./chat.js";

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

/**
 * List recent chat sessions and allow selection
 */
export async function listSessionsCommand(
  options: ListSessionsOptions = {},
): Promise<void> {
  // Fetch more sessions than we might display so the UI can choose based on screen height
  // But still limit for JSON output to keep it reasonable
  const sessions = listSessions(options.format === "json" ? 10 : 20);

  // Handle JSON format output
  if (options.format === "json") {
    console.log(
      JSON.stringify(
        {
          sessions: sessions.map((session) => ({
            id: session.sessionId,
            timestamp: session.dateCreated,
            workspaceDirectory: session.workspaceDirectory,
            title: session.title,
            firstUserMessage: session.firstUserMessage,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

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

        // Verify the session exists before trying to load it
        const sessionHistory = loadSessionById(sessionId);
        if (!sessionHistory) {
          console.error(`Session ${sessionId} could not be loaded.`);
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
