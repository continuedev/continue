import React, { useContext, useEffect, useState } from "react";
import { SessionInfo } from "../../../schema/SessionInfo";
import { GUIClientContext } from "../App";
import fetch from "node-fetch";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

function History() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const client = useContext(GUIClientContext);
  const apiUrl = useSelector((state: RootStore) => state.config.apiUrl);

  useEffect(() => {
    const fetchSessions = async () => {
      console.log("fetching sessions");
      if (!apiUrl) {
        return;
      }
      const response = await fetch(`${apiUrl}/sessions/list`);
      const json = await response.json();
      console.log(json);
      setSessions(json);
    };
    fetchSessions();
  }, [client]);

  return (
    <div style={{ width: "100%" }}>
      <table style={{ width: "100%" }}>
        <tbody>
          {sessions.map((session, index) => (
            <tr key={index}>
              <td>
                <div
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    // client?.loadSession(session.id);
                    // document.location.href = "/gui";
                  }}
                >
                  <div>{session.title}</div>
                  <div style={{ color: "lightgray" }}>
                    {session.date_created}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default History;
