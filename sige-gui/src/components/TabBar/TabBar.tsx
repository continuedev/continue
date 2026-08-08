import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { useCallback, useEffect } from "react";
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
import { varWithFallback } from "../../styles/theme";

// Haven't set up theme colors for tabs yet
// Will keep it simple and choose from existing ones. Comments show vars we could use
const tabBorderVar = varWithFallback("border"); // --vscode-tab-border
const tabBackgroundVar = varWithFallback("background"); // --vscode-tab-inactiveBackground
const tabForegroundVar = varWithFallback("foreground"); // --vscode-tab-inactiveForeground
const tabHoverBackgroundVar = varWithFallback("list-hover"); // --vscode-tab-hoverBackground
const tabHoverForegroundVar = varWithFallback("foreground"); // --vscode-tab-hoverForeground
const tabSelectedBackgroundVar = varWithFallback("background"); // --vscode-tab-activeBackground
const tabSelectedForegroundVar = varWithFallback("foreground"); // --vscode-tab-activeForeground
const tabAccentVar = varWithFallback("accent"); // --vscode-tab-activeBorderTop

const TabBarContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  flex-grow: 0;
  background-color: ${tabBackgroundVar};
  border-bottom: none;
  position: relative;
  margin-top: 2px;
  max-height: 100px;
  overflow: auto;

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
    props.isActive ? tabSelectedBackgroundVar : tabBackgroundVar};
  color: ${(props) =>
    props.isActive ? tabSelectedForegroundVar : tabForegroundVar};
  cursor: pointer;
  border: 1px solid ${tabBorderVar};
  border-bottom: ${(props) =>
    props.isActive ? "none" : `1px solid ${tabBorderVar}`};
  user-select: none;
  position: relative;
  transition: background-color 0.2s;
  border-top: ${(props) =>
    props.isActive ? `1px solid ${tabAccentVar}` : `1px solid ${tabBorderVar}`};
  &:first-child {
    border-left: none;
  }
  & + & {
    border-left: none;
  }

  &:hover {
    background-color: ${(props) =>
      props.isActive ? tabSelectedBackgroundVar : tabHoverBackgroundVar};
    color: ${(props) =>
      props.isActive ? tabSelectedForegroundVar : tabHoverForegroundVar};
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
    background-color: ${tabHoverBackgroundVar};
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
  border-bottom: 1px solid ${tabBorderVar};
  background-color: ${tabBackgroundVar};
`;

export const TabBar = React.forwardRef<HTMLDivElement>((_, ref) => {
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

  return (
    <TabBarContainer
      ref={ref}
      style={{
        display: tabs.length === 1 ? "none" : "flex",
      }}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          isActive={tab.isActive}
          onClick={() => handleTabClick(tab.id)}
          onAuxClick={(e) => {
            // Middle mouse button
            if (e.button === 1) {
              e.preventDefault();
              handleTabClose(tab.id);
            }
          }}
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
});
