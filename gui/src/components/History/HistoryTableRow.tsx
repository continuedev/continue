import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { SessionMetadata } from "core";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  deleteSession,
  getSession,
  loadSession,
  updateSession,
} from "../../redux/thunks/session";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";

function lastPartOfPath(path: string): string {
  const sep = path.includes("/") ? "/" : "\\";
  return path.split(sep).pop() || path;
}

export function HistoryTableRow({
  sessionMetadata,
  date,
  index,
}: {
  sessionMetadata: SessionMetadata;
  date: Date;
  index: number;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sessionTitleEditValue, setSessionTitleEditValue] = useState(
    sessionMetadata.title,
  );
  const currentSessionId = useAppSelector((state) => state.session.id);

  useEffect(() => {
    setSessionTitleEditValue(sessionMetadata.title);
  }, [sessionMetadata]);

  const handleKeyUp = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (sessionTitleEditValue !== sessionMetadata.title) {
        // imperfect solution of loading session just to update it
        // but fine for now, pretty low latency
        const currentSession = await getSession(
          ideMessenger,
          sessionMetadata.sessionId,
        );
        await dispatch(
          updateSession({
            ...currentSession,
            title: sessionTitleEditValue,
          }),
        );
      }
      setEditing(false);
    } else if (e.key === "Escape") {
      setSessionTitleEditValue(sessionMetadata.title);
      setEditing(false);
    }
  };

  return (
    <tr>
      <td
        data-testid={`history-row-${index}`}
        className="p-1"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="hover:bg-vsc-editor-background relative box-border flex max-w-full cursor-pointer overflow-hidden rounded-lg p-3"
          onClick={async () => {
            if (sessionMetadata.sessionId !== currentSessionId) {
              await dispatch(
                loadSession({
                  sessionId: sessionMetadata.sessionId,
                  saveCurrentSession: true,
                }),
              );
            }
            navigate("/");
          }}
        >
          <div className="flex-1 cursor-pointer space-y-1">
            {editing ? (
              <div className="text-md">
                <Input
                  type="text"
                  className="w-full"
                  ref={(titleInput) => titleInput && titleInput.focus()}
                  value={sessionTitleEditValue}
                  onChange={(e) => setSessionTitleEditValue(e.target.value)}
                  onKeyUp={(e) => handleKeyUp(e)}
                  onBlur={() => setEditing(false)}
                />
              </div>
            ) : (
              <span className="text-md block max-w-80 truncate text-base font-semibold">
                {sessionMetadata.title}
              </span>
            )}

            <div className="flex" style={{ color: "#9ca3af" }}>
              <span>
                {lastPartOfPath(sessionMetadata.workspaceDirectory || "")}
              </span>
              {/* Uncomment to show the date */}
              {/* <span className="inline-block ml-auto">
                {date.toLocaleString("en-US", {
                  year: "2-digit",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span> */}
            </div>
          </div>

          {hovered && !editing && (
            <div className="bg-vsc-background absolute right-2 top-1/2 ml-auto flex -translate-y-1/2 transform items-center gap-x-2 rounded-full py-1.5 pl-4 pr-4 shadow-md">
              <HeaderButtonWithToolTip
                text="Edit"
                onClick={async (e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
              >
                <PencilSquareIcon width="1.3em" height="1.3em" />
              </HeaderButtonWithToolTip>
              <HeaderButtonWithToolTip
                text="Delete"
                onClick={async (e) => {
                  e.stopPropagation();
                  await dispatch(deleteSession(sessionMetadata.sessionId));
                }}
              >
                <TrashIcon width="1.3em" height="1.3em" />
              </HeaderButtonWithToolTip>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
