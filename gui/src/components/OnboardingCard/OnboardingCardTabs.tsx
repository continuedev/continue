import styled from "styled-components";
import { vscButtonBackground, vscForeground } from "..";

interface OnboardingCardTabsProps {
  activeTab: string;
  onTabClick: (tabName: string) => void;
}

export enum Tabs {
  Quickstart = "Quickstart",
  Best = "Best experience",
  Local = "Local with Ollama",
}

const TabButton = styled.button<{ isActive: boolean }>`
  padding: 0.5rem 1rem;
  margin-bottom: -1px;
  focus: outline-none;
  background: transparent;
  cursor: pointer;
  color: ${vscForeground};
  border: none;

  ${({ isActive }) =>
    isActive &&
    `
    border-style: solid;
    border-width: 0 0 2.5px 0;
    border-color: ${vscButtonBackground};
    color: ${vscButtonBackground};
    font-weight: medium;
  `}
`;

const TabList = styled.div`
  border-style: solid;
  border-width: 0 0 0.5px 0;
  border-color: ${vscForeground};
`;

function OnboardingCardTabs({
  activeTab,
  onTabClick,
}: OnboardingCardTabsProps) {
  return (
    <TabList>
      {Object.values(Tabs).map((tab) => (
        <TabButton
          key={tab}
          isActive={activeTab === tab}
          onClick={() => onTabClick(tab)}
        >
          {tab}
        </TabButton>
      ))}
    </TabList>
  );
}

export default OnboardingCardTabs;
