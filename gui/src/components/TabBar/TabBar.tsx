import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";
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
  // Simple UUID generator for our needs
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }, []);

  const [tabs, setTabs] = useState([
    { id: generateId(), title: "Chat 1", isActive: true },
  ]);

  const handleNewTab = () => {
    const newTab = {
      id: generateId(),
      title: `Chat ${tabs.length + 1}`,
      isActive: false,
    };
    setTabs((prev) => {
      const updated = prev.map((tab) => ({ ...tab, isActive: false }));
      return [...updated, { ...newTab, isActive: true }];
    });
  };

  const handleTabClick = (id: string) => {
    setTabs((prev) =>
      prev.map((tab) => ({
        ...tab,
        isActive: tab.id === id,
      })),
    );
  };

  const handleTabClose = (id: string) => {
    setTabs((prev) => {
      // Safety check - never close the last tab
      if (prev.length <= 1) return prev;

      const isClosingActive = prev.find((t) => t.id === id)?.isActive;
      const filtered = prev.filter((t) => t.id !== id);

      // Safety check - if somehow we filtered all tabs, return original state
      if (filtered.length === 0) return prev;

      // If closing active tab, activate the last tab
      if (isClosingActive) {
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
