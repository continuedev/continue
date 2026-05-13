import {
  ChevronDownIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { BaseSessionMetadata } from "core";
import type { RemoteSessionMetadata } from "core/control-plane/client";
import { getUriPathBasename } from "core/util/uri";
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
  type Tab,
} from "../../redux/slices/tabsSlice";
import { AppDispatch, RootState } from "../../redux/store";
import { loadSession, saveCurrentSession } from "../../redux/thunks/session";
import { cn } from "../../util/cn";
import { parseDate } from "../History/util";

const MAX_VISIBLE_SWITCHER_RESULTS = 6;

type HeaderStatus = {
  id: string;
  label: string;
  className: string;
};

type SwitcherResult = {
  tab: Tab;
  metadata: BaseSessionMetadata | RemoteSessionMetadata | undefined;
  workspaceName: string | undefined;
  messageCountLabel: string | undefined;
  provenanceLabel: string | undefined;
  matchScore: number;
  sortTimestamp: number;
};

function getRemoteSessionLabel(metadata: RemoteSessionMetadata) {
  return `Cloud session | ${metadata.remoteId}`;
}

function getFieldMatchScore(field: string, query: string, weight: number) {
  if (!field) {
    return 0;
  }

  if (field === query) {
    return weight * 4;
  }

  if (field.startsWith(query)) {
    return weight * 3;
  }

  if (field.includes(query)) {
    return weight * 2;
  }

  return 0;
}

function getSwitcherMatchScore({
  title,
  workspaceName,
  messageCountLabel,
  sessionKindLabel,
  query,
}: {
  title: string;
  workspaceName: string;
  messageCountLabel: string;
  sessionKindLabel: string;
  query: string;
}) {
  return (
    getFieldMatchScore(title, query, 100) +
    getFieldMatchScore(workspaceName, query, 70) +
    getFieldMatchScore(sessionKindLabel, query, 30) +
    getFieldMatchScore(messageCountLabel, query, 20)
  );
}

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
  const [isShowingAllResults, setIsShowingAllResults] = useState(false);
  const [containerElement, setContainerElement] =
    useState<HTMLDivElement | null>(null);
  const switcherToggleButtonRef = useRef<HTMLButtonElement>(null);
  const switcherSearchInputRef = useRef<HTMLInputElement>(null);
  const switcherOptionRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );

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

  const normalizedSwitcherQuery = useMemo(() => {
    return switcherQuery.trim().toLowerCase();
  }, [switcherQuery]);

  const activeProvenanceLabel = useMemo(() => {
    if (isRemoteSessionMetadata(activeSessionMetadata)) {
      return getRemoteSessionLabel(activeSessionMetadata);
    }

    return undefined;
  }, [activeSessionMetadata]);

  const switcherResults = useMemo<SwitcherResult[]>(() => {
    const results = tabs
      .map((tab) => {
        const metadata = tab.sessionId
          ? sessionMetadataById.get(tab.sessionId)
          : undefined;
        const workspaceName = metadata?.workspaceDirectory
          ? getUriPathBasename(metadata.workspaceDirectory)
          : undefined;
        const messageCountLabel =
          typeof metadata?.messageCount === "number"
            ? `${metadata.messageCount} message${metadata.messageCount === 1 ? "" : "s"}`
            : undefined;
        const provenanceLabel = isRemoteSessionMetadata(metadata)
          ? getRemoteSessionLabel(metadata)
          : undefined;
        const sortTimestamp = metadata?.dateCreated
          ? parseDate(metadata.dateCreated).getTime()
          : 0;

        if (!normalizedSwitcherQuery) {
          return {
            tab,
            metadata,
            workspaceName,
            messageCountLabel,
            provenanceLabel,
            matchScore: tab.isActive ? 1 : 0,
            sortTimestamp,
          };
        }

        const matchScore = getSwitcherMatchScore({
          title: tab.title.toLowerCase(),
          workspaceName: workspaceName?.toLowerCase() ?? "",
          messageCountLabel: messageCountLabel?.toLowerCase() ?? "",
          sessionKindLabel: tab.sessionId ? "saved" : "draft",
          query: normalizedSwitcherQuery,
        });

        const provenanceMatchScore = provenanceLabel
          ? getFieldMatchScore(
              provenanceLabel.toLowerCase(),
              normalizedSwitcherQuery,
              60,
            )
          : 0;

        if (matchScore === 0 && provenanceMatchScore === 0) {
          return null;
        }

        return {
          tab,
          metadata,
          workspaceName,
          messageCountLabel,
          provenanceLabel,
          matchScore:
            matchScore + provenanceMatchScore + (tab.isActive ? 25 : 0),
          sortTimestamp,
        };
      })
      .filter((result): result is SwitcherResult => Boolean(result));

    return results.sort((left, right) => {
      const activeOrder =
        Number(right.tab.isActive) - Number(left.tab.isActive);
      if (activeOrder !== 0) {
        return activeOrder;
      }

      if (normalizedSwitcherQuery) {
        const scoreOrder = right.matchScore - left.matchScore;
        if (scoreOrder !== 0) {
          return scoreOrder;
        }
      }

      const timeOrder = right.sortTimestamp - left.sortTimestamp;
      if (timeOrder !== 0) {
        return timeOrder;
      }

      return left.tab.title.localeCompare(right.tab.title);
    });
  }, [normalizedSwitcherQuery, sessionMetadataById, tabs]);

  const visibleSwitcherResults = useMemo(() => {
    if (
      normalizedSwitcherQuery ||
      isShowingAllResults ||
      switcherResults.length <= MAX_VISIBLE_SWITCHER_RESULTS
    ) {
      return switcherResults;
    }

    return switcherResults.slice(0, MAX_VISIBLE_SWITCHER_RESULTS);
  }, [isShowingAllResults, normalizedSwitcherQuery, switcherResults]);

  const hasSwitcherOverflow = useMemo(() => {
    return (
      !normalizedSwitcherQuery &&
      switcherResults.length > MAX_VISIBLE_SWITCHER_RESULTS
    );
  }, [normalizedSwitcherQuery, switcherResults.length]);

  const hiddenSwitcherCount = Math.max(
    switcherResults.length - visibleSwitcherResults.length,
    0,
  );

  const visibleResultCountLabel = useMemo(() => {
    if (
      visibleSwitcherResults.length === tabs.length &&
      visibleSwitcherResults.length === switcherResults.length
    ) {
      return `${tabs.length} chats`;
    }

    return `Showing ${visibleSwitcherResults.length} of ${tabs.length} chats`;
  }, [switcherResults.length, tabs.length, visibleSwitcherResults.length]);

  useEffect(() => {
    setIsShowingAllResults(false);
  }, [normalizedSwitcherQuery]);

  useEffect(() => {
    const normalizedQuery = switcherQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return;
    }

    setIsShowingAllResults(true);
  }, [switcherQuery]);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      setContainerElement(node);

      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
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
      void handleNewTab();
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

  const focusSwitcherOption = useCallback(
    (index: number) => {
      const targetResult = visibleSwitcherResults[index];
      if (!targetResult) {
        return;
      }

      switcherOptionRefs.current[targetResult.tab.id]?.focus();
    },
    [visibleSwitcherResults],
  );

  const closeSwitcherAndRestoreFocus = useCallback(() => {
    setIsSwitcherOpen(false);
    switcherToggleButtonRef.current?.focus();
  }, []);

  const activateSwitcherResult = useCallback(
    (result: SwitcherResult | undefined) => {
      if (!result) {
        return;
      }

      void handleTabClick(result.tab.id);
    },
    [handleTabClick],
  );

  const handleSwitcherSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusSwitcherOption(0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusSwitcherOption(visibleSwitcherResults.length - 1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        activateSwitcherResult(visibleSwitcherResults[0]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeSwitcherAndRestoreFocus();
      }
    },
    [
      activateSwitcherResult,
      closeSwitcherAndRestoreFocus,
      focusSwitcherOption,
      visibleSwitcherResults,
    ],
  );

  const handleSwitcherToggleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIsSwitcherOpen(true);
      }
    },
    [],
  );

  const handleSwitcherOptionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusSwitcherOption(
          Math.min(index + 1, visibleSwitcherResults.length - 1),
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (index === 0) {
          switcherSearchInputRef.current?.focus();
        } else {
          focusSwitcherOption(index - 1);
        }
      } else if (event.key === "Home") {
        event.preventDefault();
        switcherSearchInputRef.current?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        focusSwitcherOption(visibleSwitcherResults.length - 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeSwitcherAndRestoreFocus();
      }
    },
    [
      closeSwitcherAndRestoreFocus,
      focusSwitcherOption,
      visibleSwitcherResults.length,
    ],
  );

  useEffect(() => {
    if (!isSwitcherOpen) {
      setSwitcherQuery("");
      setIsShowingAllResults(false);
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerElement?.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [containerElement, isSwitcherOpen]);

  useEffect(() => {
    setIsSwitcherOpen(false);
  }, [currentSessionId]);

  useEffect(() => {
    if (!isSwitcherOpen) {
      return;
    }

    switcherSearchInputRef.current?.focus();
  }, [isSwitcherOpen]);

  return (
    <div
      ref={setContainerRef}
      className="border-border bg-vsc-background relative flex flex-shrink-0 flex-col gap-2 border-0 border-b border-solid px-2 py-2"
    >
      <div className="flex items-center gap-2">
        <button
          ref={switcherToggleButtonRef}
          type="button"
          className="hover:bg-vsc-input-background/60 flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-solid border-transparent bg-transparent px-2 py-2 text-left focus-visible:border-[color:var(--vscode-focusBorder)]"
          onClick={() => setIsSwitcherOpen((current) => !current)}
          onKeyDown={handleSwitcherToggleKeyDown}
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
              {activeProvenanceLabel && (
                <span
                  className="text-description-muted truncate"
                  data-testid="chat-header-provenance"
                >
                  {activeProvenanceLabel}
                </span>
              )}
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
              ref={switcherSearchInputRef}
              type="text"
              value={switcherQuery}
              onChange={(event) => setSwitcherQuery(event.target.value)}
              onKeyDown={handleSwitcherSearchKeyDown}
              placeholder="Search chats"
              data-testid="chat-switcher-search"
              className="bg-vsc-input-background text-vsc-foreground w-full rounded-lg border border-solid border-transparent px-2 py-1.5 text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {visibleSwitcherResults.length === 0 ? (
              <div
                data-testid="chat-switcher-empty-state"
                className="text-description-muted px-2 py-3 text-sm"
              >
                No matching chats
              </div>
            ) : (
              visibleSwitcherResults.map(
                (
                  {
                    tab,
                    metadata: tabMetadata,
                    workspaceName,
                    messageCountLabel,
                    provenanceLabel,
                  },
                  index,
                ) =>
                  (() => {
                    const showRemoteBadge =
                      isRemoteSessionMetadata(tabMetadata);
                    const secondaryTextParts = [
                      tab.sessionId ? "Saved chat" : "Draft chat",
                      workspaceName,
                      provenanceLabel,
                    ].filter(Boolean);

                    return (
                      <div
                        key={tab.id}
                        className={cn(
                          "focus-within:bg-vsc-input-background/80 group flex items-center gap-2 rounded-lg px-2 py-2",
                          tab.isActive
                            ? "bg-vsc-input-background/80"
                            : "hover:bg-vsc-input-background/60",
                        )}
                      >
                        <button
                          ref={(node) => {
                            switcherOptionRefs.current[tab.id] = node;
                          }}
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 border-none bg-transparent p-0 text-left"
                          onClick={() => handleTabClick(tab.id)}
                          onKeyDown={(event) =>
                            handleSwitcherOptionKeyDown(event, index)
                          }
                          aria-label={`Switch to ${tab.title}`}
                          onAuxClick={(event) => {
                            if (event.button === 1) {
                              event.preventDefault();
                              void handleTabClose(tab.id);
                            }
                          }}
                        >
                          <div
                            className={`flex h-5 min-w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                              tab.isActive
                                ? "text-[color:var(--vscode-textLink-foreground)]"
                                : "bg-vsc-input-background text-description-muted"
                            }`}
                          >
                            {tab.isActive ? "●" : "○"}
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
                            <div className="text-description-muted flex items-center gap-1.5 truncate text-[11px]">
                              <span className="truncate">
                                {secondaryTextParts.join(" • ")}
                              </span>
                              {messageCountLabel && (
                                <span className="bg-vsc-input-background text-description hidden rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex">
                                  {messageCountLabel}
                                </span>
                              )}
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
          {hasSwitcherOverflow && (
            <div className="border-command-border border-0 border-t border-solid px-2 py-1.5">
              <button
                type="button"
                data-testid="chat-switcher-overflow-toggle"
                className="text-link hover:bg-vsc-input-background/60 w-full rounded-md px-2 py-1 text-left text-xs font-medium"
                onClick={() => setIsShowingAllResults((current) => !current)}
              >
                {isShowingAllResults
                  ? "Show fewer chats"
                  : `Show ${hiddenSwitcherCount} more chats`}
              </button>
            </div>
          )}
          <div
            className="border-command-border text-description-muted border-0 border-t border-solid px-3 py-2 text-[11px]"
            data-testid="chat-switcher-result-count"
          >
            {visibleResultCountLabel}
          </div>
        </div>
      )}
    </div>
  );
});
