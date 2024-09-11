import styled from "styled-components";
import { vscButtonBackground, vscForeground } from "../..";
import { hasPassedFTL } from "../../../util/freeTrial";

interface OnboardingCardTabsProps {
  activeTab: TabTitle;
  onTabClick: (tabName: TabTitle) => void;
}

export type TabTitle = "Quickstart" | "Best" | "Local";

export const TabTitles: { [k in TabTitle]: { xs: string; default: string } } = {
  Quickstart: {
    xs: "Quickstart",
    default: "Quickstart",
  },
  Best: {
    xs: "Best",
    default: "Best experience",
  },
  Local: {
    xs: "Local",
    default: "Local with Ollama",
  },
};

const TabButton = styled.button<{ isActive: boolean }>`
  padding: 1rem 1rem 0.5rem 1rem;
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
    border-color: ${vscForeground};
    font-weight: bold;
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
      {Object.entries(TabTitles).map(([tabType, titles]) => {
        if (hasPassedFTL() && tabType === "Quickstart") {
          return undefined;
        }

        return (
          <TabButton
            key={tabType}
            isActive={activeTab === tabType}
            onClick={() => onTabClick(tabType as TabTitle)}
          >
            <p className="hidden xs:block m-0 font-medium">{titles.default}</p>
            <p className="block xs:hidden m-0 font-medium">{titles.xs}</p>
          </TabButton>
        );
      })}
    </TabList>
  );
}

export default OnboardingCardTabs;
