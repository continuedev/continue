import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  deleteSessionMetadata,
  newSession,
  updateSessionTitle,
} from "../../redux/slices/sessionSlice";
import { loadSession } from "../../redux/thunks/session";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";

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
  const dispatch = useAppDispatch();
  const currentSessionId = useAppSelector((state) => state.session.id);
  const currentSessionTitle = useAppSelector((state) => state.session.title);
  const allSessions = useAppSelector(
    (state) => state.session.allSessionMetadata,
  );

  // Convert sessions to tabs format
  const tabs = allSessions.map((session) => ({
    id: session.sessionId,
    title: session.title,
    isActive: session.sessionId === currentSessionId,
  }));

  // If no tabs, show at least the current session
  const displayTabs =
    tabs.length === 0
      ? [
          {
            id: currentSessionId,
            title: currentSessionTitle,
            isActive: true,
          },
        ]
      : tabs;

  const handleNewTab = useCallback(() => {
    dispatch(newSession());
  }, [dispatch]);

  const handleTabClick = useCallback(
    (id: string) => {
      dispatch(
        loadSession({
          sessionId: id,
          saveCurrentSession: true,
        }),
      );
    },
    [dispatch],
  );

  const handleTabClose = useCallback(
    (id: string) => {
      // Safety check - never close the last tab
      if (displayTabs.length <= 1) return;

      const isClosingActive = id === currentSessionId;

      // If closing active tab, switch to another tab first
      if (isClosingActive) {
        const otherTab = displayTabs.find((t) => t.id !== id);
        if (otherTab) {
          dispatch(
            loadSession({
              sessionId: otherTab.id,
              saveCurrentSession: false,
            }),
          );
        }
      }

      // Then delete the session metadata
      dispatch(deleteSessionMetadata(id));
    },
    [dispatch, currentSessionId, displayTabs],
  );

  return (
    <TabBarContainer>
      {displayTabs.map((tab) => (
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
