import { SessionInfo } from "core";
import MiniSearch from "minisearch";
import React, { Fragment, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";

import useHistory from "../../hooks/useHistory";
import { getFontSize } from "../../util";
import { HistoryTableRow } from "./HistoryTableRow";
import { XMarkIcon } from "@heroicons/react/24/solid";

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

  const deleteSessionInUI = async (sessionId: string) => {
    setSessions((prev) =>
      prev.filter((session) => session.sessionId !== sessionId),
    );
  };

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const dispatch = useDispatch();
  const { getHistory, lastSessionId } = useHistory(dispatch);

  const [searchTerm, setSearchTerm] = useState("");

  const minisearch = useMemo(() => {
    return new MiniSearch({
      fields: ["title"],
      storeFields: ["title", "sessionId", "id"],
    });
  }, []);

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

  const filteredAndSortedSessions: SessionInfo[] = useMemo(() => {
    const sessionIds = minisearch
      .search(searchTerm, {
        fuzzy: 0.1,
      })
      .map((result) => result.id);

    return sessions
      .filter((session) => {
        return searchTerm === "" || sessionIds.includes(session.sessionId);
      })
      .sort(
        (a, b) =>
          parseDate(b.dateCreated).getTime() -
          parseDate(a.dateCreated).getTime(),
      );
  }, [sessions, searchTerm, minisearch]);

  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const lastWeek = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const lastMonth = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const earlier = new Date(0);

  return (
    <div style={{ fontSize: getFontSize() }}>
      <div className="relative mx-auto mb-2 mt-3 flex items-stretch justify-center space-x-2 px-2">
        <input
          className="bg-vsc-input-background text-vsc-foreground w-full flex-1 rounded-md border border-none py-1 pl-2 pr-8 text-base outline-none focus:outline-none"
          ref={searchInputRef}
          placeholder="Search past sessions"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <XMarkIcon
            className="text-vsc-foreground hover:bg-vsc-background duration-50 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 transform cursor-pointer rounded-full p-0.5 transition-colors"
            onClick={() => {
              setSearchTerm("");
              if (searchInputRef.current) {
                searchInputRef.current.focus();
              }
            }}
          />
        )}
      </div>

      {filteredAndSortedSessions.length === 0 && (
        <div className="m-4 text-center">
          No past sessions found. To start a new session, either click the "+"
          button or use the keyboard shortcut: <b>Option + Command + N</b>
        </div>
      )}

      <table className="w-full border-collapse border-spacing-0">
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
      <i className="ml-4 text-sm">
        All session data is saved in ~/.continue/sessions
      </i>
    </div>
  );
}
