import { KeyIcon } from "@heroicons/react/24/outline";
import { OnboardingModes } from "core/protocol/core";

interface OnboardingCardTabsProps {
  /** The currently active tab */
  activeTab: OnboardingModes;
  /** Callback function called when a tab is clicked */
  onTabClick: (tabName: OnboardingModes) => void;
}

const getTabIcon = (tabTitle: OnboardingModes) => {
  if (tabTitle === OnboardingModes.API_KEY) {
    return <KeyIcon className="h-4 w-4" />;
  }
  if (tabTitle === OnboardingModes.LOCAL) {
    return (
      <img
        src={`${window.vscMediaUrl}/logos/ollama.png`}
        alt="Ollama"
        className="h-4 w-4 object-contain"
      />
    );
  }
  return null;
};

/**
 * Tab navigation component for onboarding modes with responsive design
 */
export function OnboardingCardTabs({
  activeTab,
  onTabClick,
}: OnboardingCardTabsProps) {
  return (
    <div>
      <div className="xs:block hidden">
        <div className="border-foreground border-x-0 border-b border-t-0 border-solid">
          {Object.values(OnboardingModes).map((tabTitle) => {
            const isActive = activeTab === tabTitle;

            return (
              <button
                className={`xs:py-2 xs:px-3 text-foreground -mb-px cursor-pointer rounded-t-sm border-none bg-transparent px-6 py-2 font-medium hover:brightness-125 focus:outline-none sm:px-5 ${isActive ? "font-semibold" : ""}`}
                key={tabTitle}
                onClick={() => onTabClick(tabTitle as OnboardingModes)}
                data-testid={`onboarding-tab-${tabTitle}`}
              >
                <p className="m-0 flex items-center gap-2">
                  {getTabIcon(tabTitle)}
                  {tabTitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="xs:hidden block">
        <select
          className="text-foreground border-foreground w-full cursor-pointer rounded-none border-b border-none bg-transparent p-2 text-base focus:outline-none"
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
        </select>
      </div>
    </div>
  );
}
