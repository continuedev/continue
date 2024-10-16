import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { SessionInfo } from "core";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Input } from "..";
import ButtonWithTooltip from "../ButtonWithTooltip";
import useHistory from "../../hooks/useHistory";

function lastPartOfPath(path: string): string {
  const sep = path.includes("/") ? "/" : "\\";
  return path.split(sep).pop() || path;
}

export function HistoryTableRow({
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
      }
      setEditing(false);
    } else if (e.key === "Escape") {
      setEditing(false);
      setSessionTitleEditValue(session.title);
    }
  };

  return (
    <tr>
      <td
        className="p-1"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="flex max-w-full box-border p-3 relative hover:bg-vsc-editor-background rounded-lg overflow-hidden"
          onClick={async () => {
            // Save current session
            saveSession();
            await loadSession(session.sessionId);
            navigate("/");
          }}
        >
          <div className="cursor-pointer flex-1 space-y-1">
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
              <span className="truncate max-w-80 block text-md font-semibold text-base">
                {JSON.stringify(session.title).slice(1, -1)}
              </span>
            )}

            <div className="flex" style={{ color: "#9ca3af" }}>
              <span>{lastPartOfPath(session.workspaceDirectory || "")}</span>
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
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 ml-auto pl-4 pr-4 gap-x-2 flex items-center py-1 rounded-full shadow-md bg-vsc-background">
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
    </tr>
  );
}
