import { render } from "ink";
import React from "react";

import { listSessions, loadSessionById } from "../session.js";
import { SessionSelector } from "../ui/SessionSelector.js";
import { logger } from "../util/logger.js";

import { chat } from "./chat.js";

interface ListSessionsOptions {
  format?: "json";
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

        // Handle local session
        const sessionHistory = loadSessionById(sessionId);
        if (!sessionHistory) {
          logger.error(`Session ${sessionId} could not be loaded.`);
          resolve();
          return;
        }

        logger.info(`Loading session: ${sessionId}`);

        // Start chat with resume flag to load the selected session
        await chat(undefined, {
          resume: true,
          resumeSessionId: sessionId,
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
