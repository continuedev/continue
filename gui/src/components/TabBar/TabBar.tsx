import { XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius } from "..";
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

const TabBarContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  flex-grow: 0;
  background-color: var(--vscode-tab-inactiveBackground);
  border-bottom: none;
  position: relative;
  margin-top: 2px;

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
  flex-grow: 1;
  width: 100px;
  max-width: 150px;
  height: 25px;
  background-color: ${(props) =>
    props.isActive
      ? "var(--vscode-tab-activeBackground)"
      : "var(--vscode-tab-inactiveBackground)"};
  color: ${(props) =>
    props.isActive
      ? "var(--vscode-tab-activeForeground)"
      : "var(--vscode-tab-inactiveForeground)"};
  cursor: pointer;
  border: 1px solid var(--vscode-tab-border);
  border-bottom: ${(props) =>
    props.isActive ? "none" : `1px solid var(--vscode-tab-border)`};
  user-select: none;
  position: relative;
  transition: background-color 0.2s;
  border-top: ${(props) =>
    props.isActive
      ? `1px solid var(--vscode-tab-activeBorderTop, --vscode-tab-border)`
      : `1px solid var(--vscode-tab-border)`};
  &:first-child {
    border-left: none;
  }
  & + & {
    border-left: none;
  }

  &:hover {
    background-color: ${(props) =>
      props.isActive
        ? "var(--vscode-tab-activeBackground)"
        : "var(--vscode-tab-hoverBackground)"};
    color: ${(props) =>
      props.isActive
        ? "var(--vscode-tab-activeForeground)"
        : "var(--vscode-tab-hoverForeground)"};
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
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  border-radius: ${defaultBorderRadius};
  padding: 2px;
  visibility: hidden;

  &:hover {
    opacity: 1;
    background-color: var(--vscode-tab-hoverBackground);
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
  border-bottom: 1px solid var(--vscode-tab-border);
  background-color: var(--vscode-tab-inactiveBackground);
`;

const NewTabButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--vscode-tab-inactiveForeground);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
    background-color: var(--vscode-tab-hoverBackground);
    color: var(--vscode-tab-hoverForeground);
  }
`;

export function TabBar() {
  const dispatch = useDispatch<AppDispatch>();
  const currentSession = useSelector((state: RootState) => state.session);
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
  };

  return tabs.length === 1 ? (
    <></>
  ) : (
    <TabBarContainer>
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          isActive={tab.isActive}
          onClick={() => handleTabClick(tab.id)}
        >
          <TabTitle>{tab.title}</TabTitle>
          <CloseButton
            /* disabled={tabs.length === 1} */
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
        {/* <NewTabButton onClick={handleNewTab}>
          <PlusIcon width={16} height={16} />
        </NewTabButton> */}
      </TabBarSpace>
    </TabBarContainer>
  );
}
