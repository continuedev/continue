import { v4 as uuidv4 } from "uuid";

import { Session } from "..";
import { NEW_SESSION_TITLE } from "./constants";
import historyManager from "./history";
import { getSessionFilePath } from "./paths";

const sessionId = uuidv4();
const testSession: Session = {
  history: [],
  title: `${sessionId} title`,
  workspaceDirectory: "workspaceDir",
  sessionId: sessionId,
};

describe("No sessions have been created", () => {
  const testSessionId = "invalid";
  const testSessionPath = getSessionFilePath(testSessionId);

  test("Listing all sessions returns empty list", () => {
    const sessions = historyManager.list({});
    expect(sessions).toEqual([]);
  });

  test("Deleting session throws error", () => {
    expect(() => {
      historyManager.delete(testSessionId);
    }).toThrow(`Session file ${testSessionPath} does not exist`);
  });

  test("Loading session returns default session", () => {
    const session = historyManager.load(testSessionId);
    expect(session).toEqual({
      history: [],
      title: NEW_SESSION_TITLE,
      workspaceDirectory: "",
      sessionId: testSessionId,
    });
  });
});

describe("Full session lifecycle", () => {
  test("Creating and listing a session", () => {
    // save and list
    historyManager.save(testSession);
    const sessions = historyManager.list({});
    const sessionExists = sessions.some(
      (session) => session?.sessionId === testSession.sessionId,
    );
    expect(sessionExists).toBe(true);
  });

  test("Loading session by ID returns correct object", () => {
    const retrievedSession = historyManager.load(testSession.sessionId);
    expect(retrievedSession).toEqual(testSession);
  });

  test("Saving session with new title updates session", () => {
    const modifiedSession = { ...testSession };
    modifiedSession.title = `Edited: ${testSession.title}`;
    historyManager.save(modifiedSession);
    const session = historyManager.load(testSession.sessionId);

    expect(session.title).toBe(modifiedSession.title);
  });

  test("Deleting session", () => {
    historyManager.delete(testSession.sessionId);
    const sessions = historyManager.list({});
    const sessionWasDeleted = sessions.every(
      (session) => session?.sessionId !== testSession.sessionId,
    );
    expect(sessionWasDeleted).toEqual(true);
  });
});

describe("Many sessions created", () => {
  test("Create 100 sessions and list all", () => {
    for (let i = 0; i < 100; i++) {
      historyManager.save({
        history: [],
        title: `${i}`,
        workspaceDirectory: "workspaceDir",
        sessionId: `${i}`,
      });
    }
    const sessions = historyManager.list({});
    expect(sessions.length).toBe(100);
  });

  test("List 10 sessions, offest by 10", () => {
    const limit = 10;
    const offset = 10;

    const sessions = historyManager.list({ offset: offset, limit: limit });
    // Sessions are now reversed, so newest (99) comes first
    const sessionIds = Array.from({ length: limit }, (_, i) =>
      (99 - offset - i).toString(),
    );
    const isSessionIdInList = (sessionId: string) =>
      sessions.some((session) => session.sessionId === sessionId);
    expect(sessionIds.every(isSessionIdInList)).toBe(true);
  });

  test("List 25 sessions, with no offset", () => {
    const limit = 25;

    const sessions = historyManager.list({ limit: limit });
    // Sessions are now reversed, so newest (99) comes first
    const sessionIds = Array.from({ length: limit }, (_, i) =>
      (99 - i).toString(),
    );

    const isSessionIdInList = (sessionId: string) =>
      sessions.some((session) => session.sessionId === sessionId);
    expect(sessionIds.every(isSessionIdInList)).toBe(true);
  });

  test("List sessions offset by 75", () => {
    const offset = 75;

    const sessions = historyManager.list({ offset: offset });
    const sessionIds = Array.from(
      { length: sessions.length - offset },
      (_, i) => (i + offset).toString(),
    );

    const isSessionIdInList = (sessionId: string) =>
      sessions.some((session) => session.sessionId === sessionId);
    expect(sessionIds.every(isSessionIdInList)).toBe(true);
  });

  test("Delete all sessions", () => {
    let sessions = historyManager.list({});

    for (let session of sessions) {
      historyManager.delete(session.sessionId);
    }
    sessions = historyManager.list({});
    expect(sessions.length).toBe(0);
  });
});
