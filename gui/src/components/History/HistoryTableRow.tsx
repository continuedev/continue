import {
  ArrowDownOnSquareIcon,
  PencilSquareIcon,
  TrashIcon,
  CloudIcon,
} from "@heroicons/react/24/outline";
import { BaseSessionMetadata } from "core";
import type { RemoteSessionMetadata } from "core/control-plane/client";
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
  loadRemoteSession,
  loadSession,
  updateSession,
} from "../../redux/thunks/session";
import { isShareSessionSupported } from "../../util";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";

const shareSessionSupported = isShareSessionSupported();

export function HistoryTableRow({
  sessionMetadata,
  index,
}: {
  sessionMetadata: BaseSessionMetadata | RemoteSessionMetadata;
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

  const shareSession = async (sessionId: string) => {
    // "session/share" is not supported in JetBrains yet
    if (shareSessionSupported) {
      await ideMessenger.request("session/share", {
        sessionId,
      });
    }
  };
  const isRemote = "isRemote" in sessionMetadata && sessionMetadata.isRemote;

  const handleKeyUp = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (sessionTitleEditValue !== sessionMetadata.title) {
        // Don't allow editing remote sessions
        if (isRemote) {
          setSessionTitleEditValue(sessionMetadata.title);
          setEditing(false);
          return;
        }

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
        // Handle remote sessions - load remote session data
        if (isRemote) {
          const remoteSession = sessionMetadata as RemoteSessionMetadata;
          await dispatch(exitEdit({}));
          await dispatch(
            loadRemoteSession({
              remoteId: remoteSession.remoteId,
              saveCurrentSession: true,
            }),
          );
          navigate("/");
          return;
        }

        // Handle local sessions - load and navigate as before
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
          <div className="flex items-center gap-2">
            <span className="line-clamp-1 break-all text-sm font-semibold">
              {sessionMetadata.title}
            </span>
            {isRemote && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                Remote
              </span>
            )}
          </div>
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
          {isRemote ? (
            <HeaderButtonWithToolTip
              text="Open in browser"
              onClick={async (e) => {
                e.stopPropagation();
                await ideMessenger.request("controlPlane/openUrl", {
                  path: `/agents/${sessionMetadata.remoteId}`,
                });
              }}
            >
              <CloudIcon width="1em" height="1em" />
            </HeaderButtonWithToolTip>
          ) : (
            <>
              <HeaderButtonWithToolTip
                text="Edit"
                onClick={async (e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
              >
                <PencilSquareIcon width="1em" height="1em" />
              </HeaderButtonWithToolTip>
              {shareSessionSupported && (
                <HeaderButtonWithToolTip
                  text="Save Chat as Markdown"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await shareSession(sessionMetadata.sessionId);
                  }}
                >
                  <ArrowDownOnSquareIcon width="1em" height="1em" />
                </HeaderButtonWithToolTip>
              )}
              <HeaderButtonWithToolTip
                text="Delete"
                onClick={async (e) => {
                  e.stopPropagation();
                  await dispatch(deleteSession(sessionMetadata.sessionId));
                }}
              >
                <TrashIcon width="1em" height="1em" />
              </HeaderButtonWithToolTip>
            </>
          )}
        </td>
      )}
    </tr>
  );
}
