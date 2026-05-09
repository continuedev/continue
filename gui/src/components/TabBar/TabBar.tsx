import {
  ChevronDownIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { BaseSessionMetadata } from "core";
import type { RemoteSessionMetadata } from "core/control-plane/client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { newSession } from "../../redux/slices/sessionSlice";
import {
  addTab,
  handleSessionChange,
  removeTab,
  setActiveTab,
  setTabs,
} from "../../redux/slices/tabsSlice";
import { AppDispatch, RootState } from "../../redux/store";
import { loadSession, saveCurrentSession } from "../../redux/thunks/session";
import { cn } from "../../util/cn";

type HeaderStatus = {
  id: string;
  label: string;
  className: string;
};

function isRemoteSessionMetadata(
  metadata: BaseSessionMetadata | RemoteSessionMetadata | undefined,
): metadata is RemoteSessionMetadata {
  return Boolean(metadata && "isRemote" in metadata && metadata.isRemote);
}

export const TabBar = React.forwardRef<HTMLDivElement>((_, ref) => {
  const dispatch = useDispatch<AppDispatch>();
  const currentSessionId = useSelector((state: RootState) => state.session.id);
  const currentSessionTitle = useSelector(
    (state: RootState) => state.session.title,
  );
  const currentMode = useSelector((state: RootState) => state.session.mode);
  const activeAgentSessionId = useSelector(
    (state: RootState) => state.session.activeAgentSessionId,
  );
  const allSessionMetadata = useSelector(
    (state: RootState) => state.session.allSessionMetadata,
  );
  const hasHistory = useSelector(
    (state: RootState) => state.session.history.length > 0,
  );
  const tabs = useSelector((state: RootState) => state.tabs.tabs);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [switcherQuery, setSwitcherQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.isActive) ?? tabs[0];
  }, [tabs]);

  const sessionMetadataById = useMemo(() => {
    return new Map(
      allSessionMetadata.map((metadata) => [metadata.sessionId, metadata]),
    );
  }, [allSessionMetadata]);

  const activeSessionMetadata = useMemo(() => {
    return currentSessionId
      ? sessionMetadataById.get(currentSessionId)
      : undefined;
  }, [currentSessionId, sessionMetadataById]);

  const headerStatuses = useMemo<HeaderStatus[]>(() => {
    const statuses: HeaderStatus[] = [];

    if (isRemoteSessionMetadata(activeSessionMetadata)) {
      statuses.push({
        id: "remote",
        label: "Remote",
        className:
          "border-[color:var(--vscode-textLink-foreground)] text-[color:var(--vscode-textLink-foreground)]",
      });
    }

    if (currentMode === "background") {
      statuses.push({
        id: "background",
        label: "Background",
        className:
          "border-[color:var(--vscode-editorWarning-foreground)] text-[color:var(--vscode-editorWarning-foreground)]",
      });
    }

    if (currentMode === "agent" && activeAgentSessionId) {
      statuses.push({
        id: "live-agent",
        label: "Live agent",
        className:
          "border-[color:var(--vscode-testing-iconPassed)] text-[color:var(--vscode-testing-iconPassed)]",
      });
    }

    return statuses;
  }, [activeAgentSessionId, activeSessionMetadata, currentMode]);

  const filteredTabs = useMemo(() => {
    const normalizedQuery = switcherQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return tabs;
    }

    return tabs.filter((tab) =>
      tab.title.toLowerCase().includes(normalizedQuery),
    );
  }, [switcherQuery, tabs]);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;

      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  // Simple UUID generator for our needs
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;

    dispatch(
      handleSessionChange({
        currentSessionId,
        currentSessionTitle,
        newTabId: generateId(), // Pass the ID generator result
      }),
    );
  }, [currentSessionId, currentSessionTitle]);

  const handleNewTab = async () => {
    // Save current session before creating new one
    if (hasHistory) {
      await dispatch(
        saveCurrentSession({ openNewSession: false, generateTitle: true }),
      );
    }

    dispatch(newSession());

    dispatch(
      addTab({
        id: generateId(),
        title: `Chat ${tabs.length + 1}`,
        isActive: true,
        sessionId: undefined,
      }),
    );

    setIsSwitcherOpen(false);
  };

  useEffect(() => {
    if (!tabs.length) {
      handleNewTab();
    }
  }, [tabs.map((t) => t.id).join(",")]);

  const handleTabClick = async (id: string) => {
    const targetTab = tabs.find((tab) => tab.id === id);
    if (!targetTab) return;

    if (targetTab.sessionId) {
      // Switch to existing session
      await dispatch(
        loadSession({
          sessionId: targetTab.sessionId,
          saveCurrentSession: hasHistory,
        }),
      );
    }

    dispatch(setActiveTab(id));
    setIsSwitcherOpen(false);
  };

  const handleTabClose = async (id: string) => {
    //if (tabs.length <= 1) return;

    const isClosingActive = tabs.find((t) => t.id === id)?.isActive;
    const filtered = tabs.filter((t) => t.id !== id);

    if (isClosingActive) {
      const lastTab = filtered[filtered.length - 1];
      if (filtered.length) {
        await handleTabClick(lastTab.id);
        dispatch(
          setTabs(
            filtered.map((tab, i) => ({
              ...tab,
              isActive: i === filtered.length - 1,
            })),
          ),
        );
      } else {
        dispatch(setTabs([]));
        dispatch(newSession());
      }
    } else {
      dispatch(removeTab(id));
    }

    setIsSwitcherOpen(false);
  };

  useEffect(() => {
    if (!isSwitcherOpen) {
      setSwitcherQuery("");
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isSwitcherOpen]);

  useEffect(() => {
    setIsSwitcherOpen(false);
  }, [currentSessionId]);

  return (
    <div
      ref={setContainerRef}
      className="border-border bg-vsc-background relative flex flex-shrink-0 flex-col gap-2 border-0 border-b border-solid px-2 py-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="hover:bg-vsc-input-background/60 flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-solid border-transparent px-2 py-2 text-left"
          onClick={() => setIsSwitcherOpen((current) => !current)}
          aria-expanded={isSwitcherOpen}
          aria-haspopup="menu"
          aria-label="Open chat switcher"
        >
          <div className="bg-vsc-input-background text-description-muted flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-medium">
            {tabs.length}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {activeTab?.title ?? "New chat"}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-description-muted truncate">
                {tabs.length === 1
                  ? "1 open chat"
                  : `${tabs.length} open chats`}
              </span>
              {headerStatuses.map((status) => (
                <span
                  key={status.id}
                  data-testid={`chat-header-status-${status.id}`}
                  className={cn(
                    "bg-vsc-input-background inline-flex items-center rounded-full border border-solid px-2 py-0.5 font-medium",
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              ))}
            </div>
          </div>
          <ChevronDownIcon
            className={cn(
              "text-description-muted h-4 w-4 flex-shrink-0 transition-transform",
              isSwitcherOpen && "rotate-180",
            )}
          />
        </button>

        <button
          type="button"
          className="border-description text-description hover:bg-vsc-input-background hover:text-vsc-foreground inline-flex h-8 w-8 items-center justify-center rounded-lg border border-solid bg-transparent"
          onClick={handleNewTab}
          aria-label="Start new chat"
        >
          <PlusIcon className="h-4 w-4" />
        </button>

        {activeTab && tabs.length > 1 && (
          <button
            type="button"
            className="border-description text-description hover:bg-vsc-input-background hover:text-vsc-foreground inline-flex h-8 w-8 items-center justify-center rounded-lg border border-solid bg-transparent"
            onClick={() => handleTabClose(activeTab.id)}
            aria-label="Close current chat"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {isSwitcherOpen && (
        <div className="bg-vsc-editor-background border-command-border absolute left-2 right-2 top-full z-20 mt-1 overflow-hidden rounded-xl border border-solid shadow-lg">
          <div className="border-command-border border-0 border-b border-solid px-2 py-2">
            <input
              type="text"
              value={switcherQuery}
              onChange={(event) => setSwitcherQuery(event.target.value)}
              placeholder="Search chats"
              data-testid="chat-switcher-search"
              className="bg-vsc-input-background text-vsc-foreground w-full rounded-lg border border-solid border-transparent px-2 py-1.5 text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredTabs.length === 0 ? (
              <div
                data-testid="chat-switcher-empty-state"
                className="text-description-muted px-2 py-3 text-sm"
              >
                No matching chats
              </div>
            ) : (
              filteredTabs.map((tab) =>
                (() => {
                  const tabMetadata = tab.sessionId
                    ? sessionMetadataById.get(tab.sessionId)
                    : undefined;
                  const showRemoteBadge = isRemoteSessionMetadata(tabMetadata);

                  return (
                    <div
                      key={tab.id}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-2 py-2",
                        tab.isActive
                          ? "bg-vsc-input-background/80"
                          : "hover:bg-vsc-input-background/60",
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 border-none bg-transparent p-0 text-left"
                        onClick={() => handleTabClick(tab.id)}
                        aria-label={`Switch to ${tab.title}`}
                        onAuxClick={(event) => {
                          if (event.button === 1) {
                            event.preventDefault();
                            handleTabClose(tab.id);
                          }
                        }}
                      >
                        <div className="bg-vsc-input-background text-description-muted flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-medium">
                          {tab.isActive ? "A" : "C"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="truncate text-sm font-medium">
                              {tab.title}
                            </div>
                            {showRemoteBadge && (
                              <span className="bg-vsc-input-background inline-flex items-center rounded-full border border-solid border-[color:var(--vscode-textLink-foreground)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--vscode-textLink-foreground)]">
                                Remote
                              </span>
                            )}
                          </div>
                          <div className="text-description-muted truncate text-[11px]">
                            {tab.sessionId ? "Saved chat" : "Draft chat"}
                          </div>
                        </div>
                      </button>

                      {tab.isActive && (
                        <span className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[10px] font-medium">
                          Active
                        </span>
                      )}

                      <button
                        type="button"
                        className="text-description hover:bg-vsc-input-background hover:text-vsc-foreground inline-flex h-7 w-7 items-center justify-center rounded-md border-none bg-transparent opacity-80 transition-opacity group-hover:opacity-100"
                        onClick={() => handleTabClose(tab.id)}
                        aria-label={`Close ${tab.title}`}
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })(),
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
});
