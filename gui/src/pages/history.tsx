import {
  ArrowLeftIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { SessionInfo } from "core";
import MiniSearch from "minisearch";
import React, { Fragment, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  defaultBorderRadius,
  Input,
  lightGray,
  vscBackground,
  vscBadgeBackground,
  vscForeground,
  vscInputBackground,
} from "../components";
import ButtonWithTooltip from "../components/ButtonWithTooltip";
import useHistory from "../hooks/useHistory";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { getFontSize } from "../util";

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
  width: 100%;
  font-weight: bold;
  text-align: center;
  align-items: center;
  justify-content: center;
  margin: 0;
  position: sticky;
  height: 1.5em;
`;

const TdDiv = styled.div`
  cursor: pointer;
  flex-grow: 1;
  padding-left: 1rem;
  padding-right: 1rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
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
      <div className="flex justify-between items-center w-full">
        <TdDiv
          onClick={async () => {
            // Save current session
            saveSession();
            await loadSession(session.sessionId);
            navigate("/");
          }}
        >
          <div className="text-md w-100">
            {editing ? (
              <Input
                type="text"
                style={{ width: "100%" }}
                ref={(titleInput) => titleInput && titleInput.focus()}
                value={sessionTitleEditValue}
                onChange={(e) => setSessionTitleEditValue(e.target.value)}
                onKeyUp={(e) => handleKeyUp(e)}
                onBlur={() => setEditing(false)}
              />
            ) : (
              JSON.stringify(session.title).slice(1, -1)
            )}
          </div>

          <div style={{ color: "#9ca3af" }}>
            {lastPartOfPath(session.workspaceDirectory || "")}
            {!hovered && (
              <span className="inline-block float-right">
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
        </TdDiv>

        {hovered && (
          <ButtonWithTooltip
            className="mr-2"
            text="Edit"
            onClick={async () => {
              setEditing(true);
            }}
          >
            <PencilSquareIcon width="1.3em" height="1.3em" />
          </ButtonWithTooltip>
        )}

        {hovered && (
          <ButtonWithTooltip
            className="mr-2"
            text="Delete"
            onClick={async () => {
              deleteSession(session.sessionId);
              onDelete(session.sessionId);
            }}
          >
            <TrashIcon width="1.3em" height="1.3em" />
          </ButtonWithTooltip>
        )}
      </div>
    </td>
  );
}

function lastPartOfPath(path: string): string {
  const sep = path.includes("/") ? "/" : "\\";
  return path.split(sep).pop() || path;
}

function History() {
  useNavigationListener();
  const navigate = useNavigate();

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

  const stickyHistoryHeaderRef = React.useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  const dispatch = useDispatch();
  const { getHistory } = useHistory(dispatch);

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
  }, []);

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

  useEffect(() => {
    setHeaderHeight(stickyHistoryHeaderRef.current?.clientHeight || 100);
  }, [stickyHistoryHeaderRef.current]);

  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const lastWeek = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const lastMonth = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const earlier = new Date(0);

  return (
    <div className="overflow-y-scroll" style={{ fontSize: getFontSize() }}>
      <div
        ref={stickyHistoryHeaderRef}
        className="sticky top-0"
        style={{ backgroundColor: vscBackground }}
      >
        <div
          className="items-center flex m-0 p-0"
          style={{
            borderBottom: `0.5px solid ${lightGray}`,
          }}
        >
          <ArrowLeftIcon
            width="1.2em"
            height="1.2em"
            onClick={() => navigate("/")}
            className="inline-block ml-4 cursor-pointer"
          />
          <h3 className="text-lg font-bold m-2 inline-block">History</h3>
        </div>
        {/* {workspacePaths && workspacePaths.length > 0 && (
          <CheckDiv
            checked={filteringByWorkspace}
            onClick={() => setFilteringByWorkspace((prev) => !prev)}
            title={`Show only sessions from ${lastPartOfPath(
              workspacePaths[workspacePaths.length - 1]
            )}/`}
          />
        )} */}
      </div>

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
                    <SectionHeader style={{ top: `${headerHeight - 1}px` }}>
                      Today
                    </SectionHeader>
                  )}
                  {date < yesterday &&
                    date > lastWeek &&
                    prevDate > yesterday && (
                      <SectionHeader style={{ top: `${headerHeight - 1}px` }}>
                        This Week
                      </SectionHeader>
                    )}
                  {date < lastWeek &&
                    date > lastMonth &&
                    prevDate > lastWeek && (
                      <SectionHeader style={{ top: `${headerHeight - 1}px` }}>
                        This Month
                      </SectionHeader>
                    )}
                  {date < lastMonth && prevDate > lastMonth && (
                    <SectionHeader style={{ top: `${headerHeight - 1}px` }}>
                      Older
                    </SectionHeader>
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
    </div>
  );
}

export default History;
