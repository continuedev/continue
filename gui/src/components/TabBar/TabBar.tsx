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
import {
  addTab,
  removeTab,
  setActiveTab,
  setTabs,
  updateTab,
  handleSessionChange,
} from "../../redux/slices/tabsSlice";

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
  padding: 0 5px 0 12px;
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
  display: flex;
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
  visibility: hidden;

  &:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.1);
  }

  ${Tab}:hover & {
    visibility: visible;
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
  const tabs = useSelector((state: RootState) => state.tabs.tabs);

  // Simple UUID generator for our needs
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }, []);

  // Update tab title when session title changes
  useEffect(() => {
    const activeTab = tabs.find((tab) => tab.isActive);
    if (currentSessionId && currentSessionId === activeTab?.sessionId) {
      updateTab({
        id: currentSessionId,
        updates: {
          title: currentSessionTitle,
        },
      });
    }
  }, [currentSessionTitle]);

  // Handle session changes
  useEffect(() => {
    if (!currentSessionId) return;

    dispatch(
      handleSessionChange({
        currentSessionId,
        currentSessionTitle,
        newTabId: generateId(), // Pass the ID generator result
      }),
    );
  }, [currentSessionId]);

  const handleNewTab = async () => {
    // Save current session before creating new one
    if (hasHistory) {
      await dispatch(saveCurrentSession({ openNewSession: false }));
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
    }

    dispatch(setActiveTab(id));
  };

  const handleTabClose = async (id: string) => {
    if (tabs.length <= 1) return;

    const isClosingActive = tabs.find((t) => t.id === id)?.isActive;
    const filtered = tabs.filter((t) => t.id !== id);

    if (filtered.length === 0) return;

    if (isClosingActive) {
      const lastTab = filtered[filtered.length - 1];
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
      dispatch(removeTab(id));
    }
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
