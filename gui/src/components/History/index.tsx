import { SessionInfo } from "core";
import MiniSearch from "minisearch";
import React, { Fragment, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
  vscBadgeBackground,
  vscButtonBackground,
  vscButtonForeground,
  vscEditorBackground,
  vscForeground,
  vscInputBackground,
  vscInputBorder,
} from "..";
import useHistory from "../../hooks/useHistory";
import { getFontSize } from "../../util";
import { HistoryTableRow } from "./HistoryTableRow";

const parseDate = (date: string): Date => {
  let dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date(parseInt(date));
  }
  return dateObj;
};

const HEADER_CLASS =
  "flex user-select-none pt-2 pb-3 opacity-75 text-center font-bold items-center justify-center sticky h-6";

export function History() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [filteredAndSortedSessions, setFilteredAndSortedSessions] = useState<
    SessionInfo[]
  >([]);
  const apiUrl = window.serverUrl;
  const workspacePaths = window.workspacePaths || [];

  const deleteSessionInUI = async (sessionId: string) => {
    setSessions((prev) =>
      prev.filter((session) => session.sessionId !== sessionId),
    );
  };

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const dispatch = useDispatch();
  const { getHistory, lastSessionId } = useHistory(dispatch);

  const [minisearch, setMinisearch] = useState<
    MiniSearch<{ title: string; sessionId: string }>
  >(
    new MiniSearch({
      fields: ["title"],
      storeFields: ["title", "sessionId", "id"],
    }),
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchSessions = async () => {
      const sessions = await getHistory();
      setSessions(sessions);
      minisearch.addAll(
        sessions.map((session) => ({
          title: session.title,
          sessionId: session.sessionId,
          id: session.sessionId,
        })),
      );
    };
    fetchSessions();
  }, [lastSessionId]);

  useEffect(() => {
    // When searchTerm is empty only show sessions from the current workspace
    let filteringByWorkspace = searchTerm === "";

    // When the searchTerm is wildcard (asterisk) then show ALL sessions, otherwise use minisearch to search for user input
    const sessionIds = minisearch
      .search(searchTerm === "*" ? "" : searchTerm, {
        fuzzy: 0.1,
      })
      .map((result) => result.id);

    setFilteredAndSortedSessions(
      sessions
        .filter((session) => {
          if (
            !filteringByWorkspace ||
            typeof workspacePaths === "undefined" ||
            typeof session.workspaceDirectory === "undefined"
          ) {
            return true;
          }
          return workspacePaths.includes(session.workspaceDirectory);
        })
        // Filter by search term
        .filter((session) => {
          return (
            searchTerm === "*" ||
            filteringByWorkspace ||
            sessionIds.includes(session.sessionId)
          );
        })
        .sort(
          (a, b) =>
            parseDate(b.dateCreated).getTime() -
            parseDate(a.dateCreated).getTime(),
        ),
    );
  }, [sessions, searchTerm, minisearch]);

  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const lastWeek = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const lastMonth = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const earlier = new Date(0);

  return (
    <div style={{ fontSize: getFontSize() }}>
      <div className="flex px-2 pb-2 pt-3 mx-auto items-stretch justify-center space-x-2">
        <input
          className="text-base flex-1 w-full px-2 py-1 border-none rounded-md border bg-vsc-input-background text-vsc-foreground outline-none focus:outline-none"
          ref={searchInputRef}
          placeholder="Search past sessions"
          type="text"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span
          className="text-xs bg-vsc-input-background h-full block border-none text-center px-2 py-2 rounded-md w-12 select-none cursor-pointer whitespace-nowrap hover:filter hover:brightness-90"
          onClick={() => {
            if (searchInputRef.current.value === "") {
              searchInputRef.current.value = "*";
              setSearchTerm("*");
            } else {
              searchInputRef.current.value = "";
              setSearchTerm("");
            }
          }}
        >
          {searchTerm === "" ? "Show All" : "Clear"}
        </span>
      </div>

      {filteredAndSortedSessions.length === 0 && (
        <div className="text-center m-4">
          No past sessions found. To start a new session, either click the "+"
          button or use the keyboard shortcut: <b>Option + Command + N</b>
        </div>
      )}

      <table className="w-full border-spacing-0 border-collapse">
        <tbody>
          {filteredAndSortedSessions.map((session, index) => {
            const prevDate =
              index > 0
                ? parseDate(filteredAndSortedSessions[index - 1].dateCreated)
                : earlier;
            const date = parseDate(session.dateCreated);
            return (
              <Fragment key={index}>
                {index === 0 && date > yesterday && (
                  <tr className={HEADER_CLASS}>Today</tr>
                )}
                {date < yesterday &&
                  date > lastWeek &&
                  prevDate > yesterday && (
                    <tr className={HEADER_CLASS}>This Week</tr>
                  )}
                {date < lastWeek && date > lastMonth && prevDate > lastWeek && (
                  <tr className={HEADER_CLASS}>This Month</tr>
                )}
                {date < lastMonth && prevDate > lastMonth && (
                  <tr className={HEADER_CLASS}>Older</tr>
                )}

                <HistoryTableRow
                  key={session.sessionId}
                  session={session}
                  date={date}
                  onDelete={() => deleteSessionInUI(session.sessionId)}
                />
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <br />
      <i className="text-sm ml-4">
        All session data is saved in ~/.continue/sessions
      </i>
    </div>
  );
}
