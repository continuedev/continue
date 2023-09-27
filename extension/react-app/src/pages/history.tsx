import React, { useContext, useEffect, useState } from "react";
import { SessionInfo } from "../../../schema/SessionInfo";
import { GUIClientContext } from "../App";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { useNavigate } from "react-router-dom";
import { lightGray, secondaryDark, vscBackground } from "../components";
import styled from "styled-components";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import CheckDiv from "../components/CheckDiv";
import { temporarilyClearSession } from "../redux/slices/serverStateReducer";
import { getFontSize } from "../util";

const Tr = styled.tr`
  &:hover {
    background-color: ${secondaryDark};
  }

  overflow-wrap: anywhere;
`;

const parseDate = (date: string): Date => {
  let dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date(parseInt(date) * 1000);
  }
  return dateObj;
};

const SectionHeader = styled.tr`
  padding: 4px;
  padding-left: 16px;
  padding-right: 16px;
  background-color: ${secondaryDark};
  width: 100%;
  font-weight: bold;
  text-align: center;
  margin: 0;
`;

const TdDiv = styled.div`
  cursor: pointer;
  padding-left: 1rem;
  padding-right: 1rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid ${secondaryDark};
`;

function lastPartOfPath(path: string): string {
  const sep = path.includes("/") ? "/" : "\\";
  return path.split(sep).pop() || path;
}

function History() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [filteredAndSortedSessions, setFilteredAndSortedSessions] = useState<
    SessionInfo[]
  >([]);
  const client = useContext(GUIClientContext);
  const apiUrl = useSelector((state: RootStore) => state.config.apiUrl);
  const workspacePaths = useSelector(
    (state: RootStore) => state.config.workspacePaths
  );

  const [filteringByWorkspace, setFilteringByWorkspace] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      console.log("fetching sessions from: ", apiUrl);
      if (!apiUrl) {
        return;
      }
      const response = await fetch(`${apiUrl}/sessions/list`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      console.log(json);
      setSessions(json);
    };
    fetchSessions();
  }, [client]);

  useEffect(() => {
    setFilteredAndSortedSessions(
      sessions
        .filter((session) => {
          if (
            !filteringByWorkspace ||
            typeof workspacePaths === "undefined" ||
            typeof session.workspace_directory === "undefined"
          ) {
            return true;
          }
          return workspacePaths.includes(session.workspace_directory);
        })
        .sort(
          (a, b) =>
            parseDate(b.date_created).getTime() -
            parseDate(a.date_created).getTime()
        )
    );
  }, [filteringByWorkspace, sessions]);

  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const lastWeek = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const lastMonth = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const earlier = new Date(0);

  return (
    <div className="overflow-y-scroll" style={{ fontSize: getFontSize() }}>
      <div className="sticky top-0" style={{ backgroundColor: vscBackground }}>
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
        {workspacePaths && workspacePaths.length > 0 && (
          <CheckDiv
            checked={filteringByWorkspace}
            onClick={() => setFilteringByWorkspace((prev) => !prev)}
            title={`Show only sessions from ${lastPartOfPath(
              workspacePaths[workspacePaths.length - 1]
            )}/`}
          />
        )}
      </div>

      {sessions.filter((session) => {
        if (
          !filteringByWorkspace ||
          typeof workspacePaths === "undefined" ||
          typeof session.workspace_directory === "undefined"
        ) {
          return true;
        }
        return workspacePaths.includes(session.workspace_directory);
      }).length === 0 && (
        <div className="text-center my-4">
          No past sessions found. To start a new session, either click the "+"
          button or use the keyboard shortcut: <b>Option + Command + N</b>
        </div>
      )}

      <div>
        <table className="w-full">
          <tbody>
            {filteredAndSortedSessions.map((session, index) => {
              const prevDate =
                index > 0
                  ? parseDate(filteredAndSortedSessions[index - 1].date_created)
                  : earlier;
              const date = parseDate(session.date_created);
              return (
                <>
                  {index === 0 && date > yesterday && (
                    <SectionHeader>Today</SectionHeader>
                  )}
                  {date < yesterday &&
                    date > lastWeek &&
                    prevDate > yesterday && (
                      <SectionHeader>This Week</SectionHeader>
                    )}
                  {date < lastWeek &&
                    date > lastMonth &&
                    prevDate > lastWeek && (
                      <SectionHeader>This Month</SectionHeader>
                    )}

                  <Tr key={index}>
                    <td>
                      <TdDiv
                        onClick={() => {
                          client?.loadSession(session.session_id);
                          dispatch(temporarilyClearSession(true));
                          navigate("/");
                        }}
                      >
                        <div className="text-md">{session.title}</div>
                        <div className="text-gray-400">
                          {date.toLocaleString("en-US", {
                            year: "2-digit",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                          {" | "}
                          {lastPartOfPath(session.workspace_directory || "")}/
                        </div>
                      </TdDiv>
                    </td>
                  </Tr>
                </>
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
