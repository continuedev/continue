import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../redux/store";
import { loadSession, saveCurrentSession } from "../../redux/thunks/session";
import { newSession } from "../../redux/slices/sessionSlice";

const border = "var(--vscode-editorWidget-border)";

const TabBarContainer = styled.div`
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  overflow-x: auto;
  background-color: ${vscBackground};
  border-bottom: none;
  height: 25px;
  position: relative;
  margin-top: 7px;

  /* Hide scrollbar but keep functionality */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tab = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 12px;
  min-width: 100px;
  max-width: 200px;
  height: 100%;
  background-color: ${(props) =>
    props.isActive ? vscEditorBackground : "transparent"};
  color: ${vscForeground};
  cursor: pointer;
  border: 1px solid ${border};
  border-bottom: ${(props) =>
    props.isActive ? "none" : `1px solid ${border}`};
  user-select: none;
  position: relative;
  transition: background-color 0.2s;
  border-top: ${(props) =>
    props.isActive ? `2px solid #fd8c73` : `1px solid ${border}`};
  &:first-child {
    border-left: none;
  }
  & + & {
    border-left: none;
  }
`;

const TabTitle = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
`;

const CloseButton = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border: none;
  background: transparent;
  color: ${vscForeground};
  opacity: 0.7;
  cursor: pointer;
  border-radius: ${defaultBorderRadius};
  padding: 2px;

  &:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.1);
  }

  ${Tab}:hover & {
    display: flex;
  }

  &[disabled] {
    display: none !important;
  }
`;

const TabBarSpace = styled.div`
  flex: 1;
  display: flex;
  border-bottom: 1px solid ${border};
  background-color: ${vscBackground};
`;

const NewTabButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 100%;
  border: none;
  background: transparent;
  color: ${vscForeground};
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

export function TabBar() {
  const dispatch = useDispatch<AppDispatch>();
  const currentSessionId = useSelector((state: RootState) => state.session.id);
  const currentSessionTitle = useSelector(
    (state: RootState) => state.session.title,
  );
  const hasHistory = useSelector(
    (state: RootState) => state.session.history.length > 0,
  );

  console.log("currentSessionId:", currentSessionId);
  console.log("currentSessionTitle:", currentSessionTitle);

  // Simple UUID generator for our needs
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }, []);

  const [tabs, setTabs] = useState<
    {
      id: string;
      title: string;
      isActive: boolean;
      sessionId?: string;
    }[]
  >([{ id: generateId(), title: "Chat 1", isActive: true }]);

  // Initialize first tab with current session if it exists and has history
  useEffect(() => {
    if (hasHistory && currentSessionId) {
      setTabs((prev) => [
        {
          ...prev[0],
          sessionId: currentSessionId,
          title: currentSessionTitle,
        },
      ]);
    }
  }, []);

  // Update tab title when session title changes
  useEffect(() => {
    if (currentSessionId) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.sessionId === currentSessionId
            ? { ...tab, title: currentSessionTitle }
            : tab,
        ),
      );
    }
  }, [currentSessionTitle]);

  // Handle session changes
  useEffect(() => {
    if (!currentSessionId) return;

    setTabs((prev) => {
      const activeTab = prev.find((tab) => tab.isActive);
      if (!activeTab) return prev;

      // Current session matches active tab's session
      if (activeTab.sessionId === currentSessionId) {
        // Just update the title if needed
        return prev.map((tab) =>
          tab.sessionId === currentSessionId
            ? { ...tab, title: currentSessionTitle }
            : tab,
        );
      }

      // Check if there's another tab with the same session ID
      const existingTabWithSession = prev.find(
        (tab) => tab.sessionId === currentSessionId,
      );
      if (existingTabWithSession) {
        // Activate the existing tab and update its title
        // Remove any unassigned tabs
        return prev
          .filter(
            (tab) => tab.sessionId || tab.id === existingTabWithSession.id,
          )
          .map((tab) => ({
            ...tab,
            isActive: tab.id === existingTabWithSession.id,
            title:
              tab.sessionId === currentSessionId
                ? currentSessionTitle
                : tab.title,
          }));
      }

      // Active tab has no session ID: update the active tab's session ID and update its title
      if (!activeTab.sessionId) {
        return prev.map((tab) =>
          tab.isActive
            ? {
                ...tab,
                sessionId: currentSessionId,
                title: currentSessionTitle,
              }
            : tab,
        );
      }

      // If none of the above cases match, return unchanged
      return prev;
    });
  }, [currentSessionId]);

  const handleNewTab = async () => {
    // Save current session before creating new one
    if (hasHistory) {
      await dispatch(saveCurrentSession({ openNewSession: false }));
    }

    dispatch(newSession());

    const newTab = {
      id: generateId(),
      title: `Chat ${tabs.length + 1}`,
      isActive: false,
      sessionId: undefined,
    };

    setTabs((prev) => {
      const updated = prev.map((tab) => ({ ...tab, isActive: false }));
      return [...updated, { ...newTab, isActive: true }];
    });
  };

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
    } else {
      // Create new session for this tab
      if (hasHistory) {
        await dispatch(saveCurrentSession({ openNewSession: true }));
      } else {
        dispatch(newSession());
      }
      // Update tab with new session ID
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === id ? { ...tab, sessionId: currentSessionId } : tab,
        ),
      );
    }

    setTabs((prev) =>
      prev.map((tab) => ({
        ...tab,
        isActive: tab.id === id,
      })),
    );
  };

  const handleTabClose = async (id: string) => {
    setTabs((prev) => {
      // Safety check - never close the last tab
      if (prev.length <= 1) return prev;

      const isClosingActive = prev.find((t) => t.id === id)?.isActive;
      const filtered = prev.filter((t) => t.id !== id);

      // Safety check - if somehow we filtered all tabs, return original state
      if (filtered.length === 0) return prev;

      // If closing active tab, activate the last tab
      if (isClosingActive) {
        const lastTab = filtered[filtered.length - 1];
        // Handle session switch if closing active tab
        handleTabClick(lastTab.id);
        return filtered.map((tab, i) => ({
          ...tab,
          isActive: i === filtered.length - 1,
        }));
      }

      // If closing inactive tab, maintain current active state
      return filtered;
    });
  };

  return (
    <TabBarContainer>
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          isActive={tab.isActive}
          onClick={() => handleTabClick(tab.id)}
        >
          <TabTitle>{tab.title}</TabTitle>
          <CloseButton
            disabled={tabs.length === 1}
            onClick={(e) => {
              e.stopPropagation();
              handleTabClose(tab.id);
            }}
          >
            <XMarkIcon width={12} height={12} />
          </CloseButton>
        </Tab>
      ))}
      <TabBarSpace>
        <NewTabButton onClick={handleNewTab}>
          <PlusIcon width={16} height={16} />
        </NewTabButton>
      </TabBarSpace>
    </TabBarContainer>
  );
}
