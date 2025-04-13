import { SessionMetadata } from "core";
import MiniSearch from "minisearch";
import React, {
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Shortcut from "../gui/Shortcut";

import { XMarkIcon } from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  newSession,
  setAllSessionMetadata,
} from "../../redux/slices/sessionSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { refreshSessionMetadata } from "../../redux/thunks/session";
import { getFontSize, getPlatform } from "../../util";
import { ROUTES } from "../../util/navigation";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import { HistoryTableRow } from "./HistoryTableRow";

const parseDate = (date: string): Date => {
  let dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date(parseInt(date));
  }
  return dateObj;
};

const HEADER_CLASS =
  "flex user-select-none pt-2 pb-3 opacity-75 text-center font-bold items-center justify-center sticky h-6";

export function History() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const ideMessenger = useContext(IdeMessengerContext);

  const [searchTerm, setSearchTerm] = useState("");

  const minisearch = useRef<MiniSearch>(
    new MiniSearch({
      fields: ["title"],
      storeFields: ["title", "sessionId", "id"],
    }),
  ).current;

  const allSessionMetadata = useAppSelector(
    (state) => state.session.allSessionMetadata,
  );

  useEffect(() => {
    try {
      minisearch.removeAll();
      minisearch.addAll(
        allSessionMetadata.map((session) => ({
          title: session.title,
          sessionId: session.sessionId,
          id: session.sessionId,
        })),
      );
    } catch (e) {
      console.log("error adding sessions to minisearch", e);
    }
  }, [allSessionMetadata]);

  const platform = useMemo(() => getPlatform(), []);

  const filteredAndSortedSessions: SessionMetadata[] = useMemo(() => {
    const sessionIds = minisearch
      .search(searchTerm, {
        fuzzy: 0.1,
      })
      .map((result) => result.id);

    return allSessionMetadata
      .filter((session) => {
        return searchTerm === "" || sessionIds.includes(session.sessionId);
      })
      .sort(
        (a, b) =>
          parseDate(b.dateCreated).getTime() -
          parseDate(a.dateCreated).getTime(),
      );
  }, [allSessionMetadata, searchTerm, minisearch]);

  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const lastWeek = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const lastMonth = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const earlier = new Date(0);

  const showClearSessionsDialog = () => {
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title={`Clear sessions`}
          text={`Are you sure you want to permanently delete all chat sessions, including the current chat session?`}
          onConfirm={async () => {
            // optimistic update
            dispatch(setAllSessionMetadata([]));

            // actual update + refresh
            await ideMessenger.request("history/clear", undefined);
            dispatch(refreshSessionMetadata({}));

            // start a new session
            dispatch(newSession());
            navigate(ROUTES.HOME);
          }}
        />,
      ),
    );
    dispatch(setShowDialog(true));
  };

  return (
    <div
      style={{ fontSize: getFontSize() }}
      className="flex flex-1 flex-col overflow-auto px-1"
    >
      <div className="relative my-2 flex justify-center space-x-2">
        <input
          className="bg-vsc-input-background text-vsc-foreground flex-1 rounded-md border border-none py-1 pl-2 pr-8 text-base outline-none focus:outline-none"
          ref={searchInputRef}
          placeholder="Search past sessions"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <XMarkIcon
            className="text-vsc-foreground hover:bg-vsc-background duration-50 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 transform cursor-pointer rounded-full p-0.5 transition-colors"
            onClick={() => {
              setSearchTerm("");
              if (searchInputRef.current) {
                searchInputRef.current.focus();
              }
            }}
          />
        )}
      </div>
      <div className="thin-scrollbar flex flex-1 flex-col overflow-y-auto pr-4">
        {filteredAndSortedSessions.length === 0 && (
          <div className="m-3 text-center">
            No past sessions found. To start a new session, either click the "+"
            button or use the keyboard shortcut: <Shortcut>meta L</Shortcut>
          </div>
        )}

        <table className="flex flex-1 flex-col">
          <tbody className="">
            {filteredAndSortedSessions.map((session, index) => {
              const prevDate =
                index > 0
                  ? parseDate(filteredAndSortedSessions[index - 1].dateCreated)
                  : earlier;
              const date = parseDate(session.dateCreated);
              return (
                <Fragment key={index}>
                  {index === 0 && date > yesterday && (
                    <tr className={HEADER_CLASS}>
                      <td colSpan={3}>Today</td>
                    </tr>
                  )}
                  {date < yesterday &&
                    date > lastWeek &&
                    prevDate > yesterday && (
                      <div className={HEADER_CLASS}>
                        <td colSpan={3}>This Week</td>
                      </div>
                    )}
                  {date < lastWeek &&
                    date > lastMonth &&
                    prevDate > lastWeek && (
                      <div className={HEADER_CLASS}>
                        <td colSpan={3}>This Month</td>
                      </div>
                    )}
                  {date < lastMonth && prevDate > lastMonth && (
                    <div className={HEADER_CLASS}>
                      <td colSpan={3}>Older</td>
                    </div>
                  )}

                  <HistoryTableRow
                    sessionMetadata={session}
                    date={date}
                    index={index}
                  />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-end justify-center border-0 border-t border-solid border-gray-400 px-2 py-1.5 text-sm">
        <i
          className=""
          data-testid="history-sessions-note"
        >{`Data is saved in ${platform === "windows" ? "%USERPROFILE%/.continue" : "~/.continue/sessions"}`}</i>
        <span
          className="cursor-pointer text-xs text-gray-400 hover:underline"
          onClick={showClearSessionsDialog}
        >
          Clear session history
        </span>
      </div>
    </div>
  );
}
