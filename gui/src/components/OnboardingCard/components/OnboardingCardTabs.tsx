import { OnboardingModes } from "core/protocol/core";
import styled from "styled-components";
import { vscForeground } from "../..";

interface OnboardingCardTabsProps {
  activeTab: OnboardingModes;
  onTabClick: (tabName: OnboardingModes) => void;
}

const StyledSelect = styled.select`
  width: 100%;
  padding: 0.5rem;
  background-color: transparent;
  color: ${vscForeground};
  border: none;
  border-bottom: 1px solid ${vscForeground};
  border-radius: 0;
  font-size: 1rem;
  cursor: pointer;
  display: block;

  &:focus {
    outline: none;
  }
`;

const TabButton = styled.button<{ isActive: boolean }>`
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

export function OnboardingCardTabs({
  activeTab,
  onTabClick,
}: OnboardingCardTabsProps) {
  console.log({ keys: Object.values(OnboardingModes) });
  return (
    <div>
      <div className="xs:block hidden">
        <TabList>
          {Object.values(OnboardingModes).map((tabTitle) => {
            return (
              <TabButton
                className="xs:py-2 xs:px-3 rounded-t-sm px-6 py-2 hover:brightness-125 sm:px-5"
                key={tabTitle}
                isActive={activeTab === tabTitle}
                onClick={() => onTabClick(tabTitle as OnboardingModes)}
                data-testid={`onboarding-tab-${tabTitle}`}
              >
                <p className="m-0 font-medium">{tabTitle}</p>
              </TabButton>
            );
          })}
        </TabList>
      </div>
      <div className="xs:hidden block">
        <StyledSelect
          value={activeTab}
          onChange={(e) => onTabClick(e.target.value as OnboardingModes)}
        >
          {Object.values(OnboardingModes).map((tabTitle) => {
            return (
              <option key={tabTitle} value={tabTitle}>
                {tabTitle}
              </option>
            );
          })}
        </StyledSelect>
      </div>
    </div>
  );
}
