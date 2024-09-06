import styled from "styled-components";
import {
  vscButtonBackground,
  vscButtonForeground,
  vscFocusBorder,
  vscForeground,
} from "..";

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

function OnboardingCardTabs({
  activeTab,
  onTabClick,
}: OnboardingCardTabsProps) {
  return (
    <div role="tablist" className="">
      {Object.values(Tabs).map((tab) => (
        <TabButton
          key={tab}
          isActive={activeTab === tab}
          onClick={() => onTabClick(tab)}
        >
          {tab}
        </TabButton>
      ))}
    </div>
  );
}

export default OnboardingCardTabs;
