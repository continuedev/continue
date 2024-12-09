import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { SessionMetadata } from "core";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "..";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { switchToSession } from "../../redux/thunks/session";

function lastPartOfPath(path: string): string {
  const sep = path.includes("/") ? "/" : "\\";
  return path.split(sep).pop() || path;
}

export function HistoryTableRow({
  sessionMetadata,
  date,
}: {
  sessionMetadata: SessionMetadata;
  date: Date;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sessionTitleEditValue, setSessionTitleEditValue] = useState(
    sessionMetadata.title,
  );
  const currentSessionId = useAppSelector((state) => state.session.id);

  const handleKeyUp = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (sessionTitleEditValue !== sessionMetadata.title) {
        const session;
        const sessionData = await getSession(sessionMetadata.sessionId);
        sessionData.title = sessionTitleEditValue;
        await updateSession(sessionData);
        onEdit({
          ...sessionMetadata,
          title: sessionTitleEditValue,
        });
      }
      setEditing(false);
    } else if (e.key === "Escape") {
      setEditing(false);
      setSessionTitleEditValue(sessionMetadata.title);
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
          className="hover:bg-vsc-editor-background relative box-border flex max-w-full cursor-pointer overflow-hidden rounded-lg p-3"
          onClick={async () => {
            if (sessionMetadata.sessionId !== currentSessionId) {
              await dispatch(switchToSession(sessionMetadata.sessionId));
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
                {JSON.stringify(sessionMetadata.title).slice(1, -1)}
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
                  await deleteSession(sessionMetadata.sessionId);
                  onDelete(sessionMetadata.sessionId);
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
