import { SessionMetadata } from "core";
import MiniSearch from "minisearch";
import {
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Shortcut from "../gui/Shortcut";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
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
import { cn } from "../../util/cn";
import { ROUTES } from "../../util/navigation";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import { Button } from "../ui";
import { HistoryTableRow } from "./HistoryTableRow";
import { groupSessionsByDate, parseDate } from "./util";

const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
const lastWeek = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
const lastMonth = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
const earlier = new Date(0);

const HEADER_CLASS = "user-select-none sticky mb-3 ml-2 flex h-6 justify-start text-left text-base font-bold opacity-75";

export function History() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const ideMessenger = useContext(IdeMessengerContext);

  const [searchTerm, setSearchTerm] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const minisearch = useRef<MiniSearch>(
    new MiniSearch({
      fields: ["title"],
      storeFields: ["title", "sessionId", "id"],
    }),
  ).current;

  const allSessionMetadata = useAppSelector(
    (state) => state.session.allSessionMetadata,
  );
  const isSessionMetadataLoading = useAppSelector(
    (state) => state.session.isSessionMetadataLoading,
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
    const exactResults = minisearch.search(searchTerm, {
      fuzzy: false,
    });

    const fuzzyResults = minisearch.search(searchTerm, {
      fuzzy: 0.3,
    });

    const prefixResults = minisearch.search(searchTerm, {
      prefix: true,
      fuzzy: 0.2,
    });

    const allResults = [
      ...exactResults.map((r) => ({ ...r, priority: 3 })),
      ...fuzzyResults.map((r) => ({ ...r, priority: 2 })),
      ...prefixResults.map((r) => ({ ...r, priority: 1 })),
    ];

    const uniqueResultsMap = new Map<string, any>();
    allResults.forEach((result) => {
      const existing = uniqueResultsMap.get(result.id);
      if (!existing || existing.priority < result.priority) {
        uniqueResultsMap.set(result.id, result);
      }
    });

    const sessionIds = Array.from(uniqueResultsMap.values())
      .sort((a, b) => b.priority - a.priority || b.score - a.score)
      .map((result) => result.id);

    return allSessionMetadata
      .filter(
        (session) =>
          searchTerm === "" || sessionIds.includes(session.sessionId),
      )
      .sort(
        (a, b) =>
          parseDate(b.dateCreated).getTime() -
          parseDate(a.dateCreated).getTime(),
      );
  }, [allSessionMetadata, searchTerm, minisearch]);

  const sessionGroups = useMemo(() => {
    return groupSessionsByDate(filteredAndSortedSessions);
  }, [filteredAndSortedSessions]);

  const showClearSessionsDialog = () => {
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title={`Clear sessions`}
          text={`Are you sure you want to permanently delete all chat sessions, including the current chat session?`}
          onConfirm={async () => {
            dispatch(setAllSessionMetadata([]));
            await ideMessenger.request("history/clear", undefined);
            void dispatch(refreshSessionMetadata({}));
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
      className={`flex flex-1 flex-col overflow-auto px-1 transition-all duration-300 ${
        collapsed ? "w-10" : "w-full"
      }`}
    >
      <div className="relative my-2 mt-4 flex justify-center space-x-2">
        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="bg-vsc-background text-vsc-foreground hover:bg-vsc-editor-background absolute left-2 top-1/2 -translate-y-1/2 transform rounded-md p-1"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <ChevronLeftIcon className="h-5 w-5" />
          )}
        </button>

        {/* Search Input */}
        <input
          className="bg-vsc-input-background text-vsc-foreground flex-1 rounded-md border border-none py-1 pl-8 pr-8 text-sm outline-none focus:outline-none"
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

      {!collapsed && (
        <>
          <div className="thin-scrollbar flex flex-1 flex-col overflow-y-auto">
            {filteredAndSortedSessions.length === 0 && (
              <div className="m-3 text-center">
                {isSessionMetadataLoading ? (
                  "Loading Sessions..."
                ) : (
                  <>
                    No past sessions found. To start a new session, either click the
                    "+" button or use the keyboard shortcut:{" "}
                    <Shortcut>meta L</Shortcut>
                  </>
                )}
              </div>
            )}

            <table className="flex flex-1 flex-col">
              <tbody className="">
                {sessionGroups.map((group, groupIndex) => (
                  <Fragment key={group.label}>
                    <tr
                      className={cn(
                        "user-select-none sticky mb-3 ml-2 flex h-6 justify-start text-left text-base font-bold opacity-75",
                        groupIndex === 0 ? "mt-2" : "mt-8",
                      )}
                    >
                      <td colSpan={3}>{group.label}</td>
                    </tr>
                    {group.sessions.map((session, sessionIndex) => (
                      <HistoryTableRow
                        key={session.sessionId}
                        sessionMetadata={session}
                        index={sessionIndex}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border flex flex-col items-end justify-center border-0 border-t border-solid px-2 py-3 text-xs">
            <Button variant="secondary" size="sm" onClick={showClearSessionsDialog}>
              Clear chats
            </Button>
            <span
              className="text-description text-2xs"
              data-testid="history-sessions-note"
            >
              Chat history is saved to{" "}
              <span className="italic">
                {platform === "windows"
                  ? "%USERPROFILE%/.continue"
                  : "~/.continue/sessions"}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
