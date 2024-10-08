import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { SessionInfo } from "core";
import MiniSearch from "minisearch";
import React, { Fragment, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  defaultBorderRadius,
  Input,
  vscBadgeBackground,
  vscForeground,
  vscInputBackground,
} from ".";
import ButtonWithTooltip from "./ButtonWithTooltip";
import useHistory from "../hooks/useHistory";

const SearchBarContainer = styled.div`
  display: flex;
  max-width: 500px;
  padding: 0 8px 0 8px;
  margin: 0 auto;
  align-items: center;
  justify-content: center;
`;

const SearchBar = styled.input`
  padding: 4px 8px;
  border-radius: ${defaultBorderRadius};
  border: 0.5px solid #888;
  outline: none;
  margin: 8px auto;
  display: block;
  background-color: ${vscInputBackground};
  color: ${vscForeground};
  &:focus {
    border: 0.5px solid ${vscBadgeBackground};
    outline: none;
  }
`;

const Tr = styled.tr`
  &:hover {
    background-color: ${vscInputBackground};
  }

  overflow-wrap: anywhere;

  border-bottom: 1px solid ${vscInputBackground};
  border-top: 1px solid ${vscInputBackground};
`;

const parseDate = (date: string): Date => {
  let dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date(parseInt(date));
  }
  return dateObj;
};

const SectionHeader = styled.tr`
  display: flex;
  user-select: none;
  padding: 4px;
  background-color: ${vscInputBackground};
  width: calc(100% - 8px);
  font-weight: bold;
  text-align: center;
  align-items: center;
  justify-content: center;
  margin: 0;
  position: sticky;
  height: 1.5em;
`;

function TableRow({
  session,
  date,
  onDelete,
}: {
  session: SessionInfo;
  date: Date;
  onDelete: (sessionId: string) => void;
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const apiUrl = window.serverUrl;
  const workspacePaths = window.workspacePaths || [""];
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sessionTitleEditValue, setSessionTitleEditValue] = useState(
    session.title,
  );

  const { saveSession, deleteSession, loadSession, getSession, updateSession } =
    useHistory(dispatch);

  const handleKeyUp = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (sessionTitleEditValue !== session.title) {
        session.title = sessionTitleEditValue;
        const persistedSessionInfo = await getSession(session.sessionId);
        persistedSessionInfo.title = sessionTitleEditValue;
        await updateSession(persistedSessionInfo);
        setEditing(false);
      }
    } else if (e.key === "Escape") {
      setEditing(false);
      setSessionTitleEditValue(session.title);
    }
  };

  return (
    <td
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flex max-w-full box-border px-4 py-2"
        onClick={async () => {
          // Save current session
          saveSession();
          await loadSession(session.sessionId);
          navigate("/");
        }}
      >
        <div className="cursor-pointer flex-1">
          {editing ? (
            <div className="text-md">
              <Input
                type="text"
                style={{ width: "100%" }}
                ref={(titleInput) => titleInput && titleInput.focus()}
                value={sessionTitleEditValue}
                onChange={(e) => setSessionTitleEditValue(e.target.value)}
                onKeyUp={(e) => handleKeyUp(e)}
                onBlur={() => setEditing(false)}
              />
            </div>
          ) : (
            <span className="truncate max-w-60 block">
              {JSON.stringify(session.title).slice(1, -1)}
            </span>
          )}

          <div className="flex" style={{ color: "#9ca3af" }}>
            <span>{lastPartOfPath(session.workspaceDirectory || "")}</span>
            {!hovered && (
              <span className="inline-block ml-auto">
                {date.toLocaleString("en-US", {
                  year: "2-digit",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            )}
          </div>
        </div>

        {hovered && (
          <div className="ml-auto pl-2 gap-x-2 flex">
            <ButtonWithTooltip
              text="Edit"
              onClick={async (e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              <PencilSquareIcon width="1.3em" height="1.3em" />
            </ButtonWithTooltip>
            <ButtonWithTooltip
              text="Delete"
              onClick={async () => {
                deleteSession(session.sessionId);
                onDelete(session.sessionId);
              }}
            >
              <TrashIcon width="1.3em" height="1.3em" />
            </ButtonWithTooltip>
          </div>
        )}
      </div>
    </td>
  );
}

function lastPartOfPath(path: string): string {
  const sep = path.includes("/") ? "/" : "\\";
  return path.split(sep).pop() || path;
}

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
    <div>
      <SearchBarContainer className="space-x-2">
        <SearchBar
          className="flex-1 w-full"
          ref={searchInputRef}
          placeholder="Search past sessions"
          type="text"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span
          className="block text-center px-2 py-1.5 rounded-md w-12 mx-1 my-2 select-none cursor-pointer"
          style={{
            fontSize: "11px",
            backgroundColor:
              searchTerm !== "" ? vscInputBackground : vscBadgeBackground,
          }}
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
      </SearchBarContainer>

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
                  <SectionHeader>Today</SectionHeader>
                )}
                {date < yesterday &&
                  date > lastWeek &&
                  prevDate > yesterday && (
                    <SectionHeader>This Week</SectionHeader>
                  )}
                {date < lastWeek && date > lastMonth && prevDate > lastWeek && (
                  <SectionHeader>This Month</SectionHeader>
                )}
                {date < lastMonth && prevDate > lastMonth && (
                  <SectionHeader>Older</SectionHeader>
                )}

                <Tr key={index}>
                  <TableRow
                    session={session}
                    date={date}
                    onDelete={() => deleteSessionInUI(session.sessionId)}
                  ></TableRow>
                </Tr>
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
