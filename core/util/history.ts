import * as fs from "fs";
import { PersistedSessionInfo, SessionInfo } from "..";
import { getSessionFilePath, getSessionsListPath } from "./paths";

class HistoryManager {
  list(): SessionInfo[] {
    const filepath = getSessionsListPath();
    if (!fs.existsSync(filepath)) {
      return [];
    }
    const content = fs.readFileSync(filepath, "utf8");
    const sessions = JSON.parse(content).filter((session: any) => {
      // Filter out old format
      return typeof session.session_id !== "string";
    });
    return sessions;
  }

  delete(sessionId: string) {
    // Delete a session
    const sessionFile = getSessionFilePath(sessionId);
    if (!fs.existsSync(sessionFile)) {
      throw new Error(`Session file ${sessionFile} does not exist`);
    }
    fs.unlinkSync(sessionFile);

    // Read and update the sessions list
    const sessionsListFile = getSessionsListPath();
    const sessionsListRaw = fs.readFileSync(sessionsListFile, "utf-8");
    let sessionsList: SessionInfo[];
    try {
      sessionsList = JSON.parse(sessionsListRaw);
    } catch (error) {
      throw new Error(
        `It looks like there is a JSON formatting error in your sessions.json file (${sessionsListFile}). Please fix this before creating a new session.`,
      );
    }

    sessionsList = sessionsList.filter(
      (session) => session.sessionId !== sessionId,
    );

    fs.writeFileSync(sessionsListFile, JSON.stringify(sessionsList));
  }

  load(sessionId: string): PersistedSessionInfo {
    try {
      const sessionFile = getSessionFilePath(sessionId);
      if (!fs.existsSync(sessionFile)) {
        throw new Error(`Session file ${sessionFile} does not exist`);
      }
      const session: PersistedSessionInfo = JSON.parse(
        fs.readFileSync(sessionFile, "utf8"),
      );
      session.sessionId = sessionId;
      return session;
    } catch (e) {
      console.log(`Error migrating session: ${e}`);
      return {
        history: [],
        title: "Failed to load session",
        workspaceDirectory: "",
        sessionId: sessionId,
      };
    }
  }

  save(session: PersistedSessionInfo) {
    // Save the main session json file
    fs.writeFileSync(
      getSessionFilePath(session.sessionId),
      JSON.stringify(session),
    );

    // Read and update the sessions list
    const sessionsListFilePath = getSessionsListPath();
    try {
      const rawSessionsList = fs.readFileSync(sessionsListFilePath, "utf-8");

      let sessionsList: SessionInfo[];
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

      let found = false;
      for (const sessionInfo of sessionsList) {
        if (sessionInfo.sessionId === session.sessionId) {
          sessionInfo.title = session.title;
          sessionInfo.workspaceDirectory = session.workspaceDirectory;
          sessionInfo.dateCreated = String(Date.now());
          found = true;
          break;
        }
      }

      if (!found) {
        const sessionInfo: SessionInfo = {
          sessionId: session.sessionId,
          title: session.title,
          dateCreated: String(Date.now()),
          workspaceDirectory: session.workspaceDirectory,
        };
        sessionsList.push(sessionInfo);
      }

      fs.writeFileSync(sessionsListFilePath, JSON.stringify(sessionsList));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          `It looks like there is a JSON formatting error in your sessions.json file (${sessionsListFilePath}). Please fix this before creating a new session.`,
        );
      } else {
        throw new Error(
          `It looks like there is a validation error in your sessions.json file (${sessionsListFilePath}). Please fix this before creating a new session. Error: ${error}`,
        );
      }
    }
  }
}

const historyManager = new HistoryManager();

export default historyManager;
