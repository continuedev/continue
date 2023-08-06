import React, { useContext, useEffect, useState } from "react";
import { SessionInfo } from "../../../schema/SessionInfo";
import { GUIClientContext } from "../App";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { useNavigate } from "react-router-dom";
import { secondaryDark, vscBackground } from "../components";
import styled from "styled-components";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const Tr = styled.tr`
  &:hover {
    background-color: ${secondaryDark};
  }
`;

const TdDiv = styled.div`
  cursor: pointer;
  padding-left: 1rem;
  padding-right: 1rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid ${secondaryDark};
`;

function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const client = useContext(GUIClientContext);
  const apiUrl = useSelector((state: RootStore) => state.config.apiUrl);

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

  return (
    <div className="w-full">
      <div className="items-center flex">
        <ArrowLeftIcon
          width="1.4em"
          height="1.4em"
          onClick={() => navigate("/")}
          className="inline-block ml-4 cursor-pointer"
        />
        <h1 className="text-2xl font-bold m-4 inline-block">History</h1>
      </div>
      <table className="w-full">
        <tbody>
          {sessions.map((session, index) => (
            <Tr key={index}>
              <td>
                <TdDiv
                  onClick={() => {
                    client?.loadSession(session.session_id);
                    navigate("/");
                  }}
                >
                  <div className="text-lg">{session.title}</div>
                  <div className="text-gray-400">{session.date_created}</div>
                </TdDiv>
              </td>
            </Tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default History;
