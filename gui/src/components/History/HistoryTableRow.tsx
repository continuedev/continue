import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { SessionMetadata } from "core";
import { getUriPathBasename } from "core/util/uri";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { exitEdit } from "../../redux/thunks/edit";
import {
  deleteSession,
  getSession,
  loadSession,
  updateSession,
} from "../../redux/thunks/session";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";

export function HistoryTableRow({
  sessionMetadata,
  index,
}: {
  sessionMetadata: SessionMetadata;
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
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`history-row-${index}`}
      className="hover:bg-input relative mb-2 box-border flex w-full cursor-pointer overflow-hidden rounded-lg p-3"
      onClick={async () => {
        await dispatch(exitEdit({}));
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
      <td className="flex-1 cursor-pointer space-y-1">
        {editing ? (
          <div>
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
          <span className="line-clamp-1 break-all text-sm font-semibold">
            {sessionMetadata.title}
          </span>
        )}

        <div className="text-description-muted flex">
          <span className="line-clamp-1 break-all text-xs">
            {getUriPathBasename(sessionMetadata.workspaceDirectory || "")}
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
      </td>

      {hovered && !editing && (
        <td className="bg-input absolute right-2 top-1/2 ml-auto flex -translate-y-1/2 transform items-center gap-x-1 rounded-full px-2 py-1 shadow-md">
          <HeaderButtonWithToolTip
            text="Edit"
            onClick={async (e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            <PencilSquareIcon width="1em" height="1em" />
          </HeaderButtonWithToolTip>
          <HeaderButtonWithToolTip
            text="Delete"
            onClick={async (e) => {
              e.stopPropagation();
              await dispatch(deleteSession(sessionMetadata.sessionId));
            }}
          >
            <TrashIcon width="1em" height="1em" />
          </HeaderButtonWithToolTip>
        </td>
      )}
    </tr>
  );
}
