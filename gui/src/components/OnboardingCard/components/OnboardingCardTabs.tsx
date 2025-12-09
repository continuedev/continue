import { KeyIcon } from "@heroicons/react/24/outline";
import { OnboardingModes } from "core/protocol/core";
import ContinueSignet from "../../svg/ContinueSignet";
import OllamaLogo from "../../svg/OllamaLogo";

interface OnboardingCardTabsProps {
  activeTab: OnboardingModes;
  onTabClick: (tabName: OnboardingModes) => void;
}

const renderTabButton = (
  tabTitle: OnboardingModes,
  index: number,
  activeTab: OnboardingModes,
  onTabClick: (tabName: OnboardingModes) => void,
) => {
  const baseButtonClass = `text-foreground -mb-px cursor-pointer rounded-t-sm border-none bg-transparent py-2 font-medium hover:brightness-125 focus:outline-none ${index === 0 ? "pl-1.5 pr-3" : "px-3"} ${activeTab === tabTitle ? "brightness-125" : "brightness-75"}`;

  if (tabTitle === OnboardingModes.API_KEY) {
    return (
      <button
        className={baseButtonClass}
        key={tabTitle}
        onClick={() => onTabClick(tabTitle as OnboardingModes)}
        data-testid={`onboarding-tab-${tabTitle}`}
      >
        <KeyIcon className="-mb-0.5 mr-2 h-4 w-4" />
        {tabTitle}
      </button>
    );
  }

  if (tabTitle === OnboardingModes.LOCAL) {
    return (
      <button
        className={baseButtonClass}
        key={tabTitle}
        onClick={() => onTabClick(tabTitle as OnboardingModes)}
        data-testid={`onboarding-tab-${tabTitle}`}
      >
        <OllamaLogo width={18} height={18} className="-mb-0.5 mr-2" />
        {tabTitle}
      </button>
    );
  }

  if (tabTitle === OnboardingModes.MODELS_ADD_ON) {
    return (
      <button
        className={`${baseButtonClass} -ml-1.5`}
        key={tabTitle}
        onClick={() => onTabClick(tabTitle as OnboardingModes)}
        data-testid={`onboarding-tab-${tabTitle}`}
      >
        <ContinueSignet width={32} height={32} className="-mb-2.5" />
        Credits
      </button>
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
  // Show Models Add-On (Credits) first as the primary option
  const tabs = [
    OnboardingModes.MODELS_ADD_ON,
    OnboardingModes.API_KEY,
    OnboardingModes.LOCAL,
  ];
  return (
    <div>
      <div className="hidden sm:block">
        <div className="border-foreground border-x-0 border-b border-t-0 border-solid">
          {tabs.map((tabTitle, index) =>
            renderTabButton(tabTitle, index, activeTab, onTabClick),
          )}
        </div>
      </div>

      <div className="block sm:hidden">
        <select
          className="text-foreground border-border mt-4 w-full cursor-pointer rounded-none border-x-0 border-b border-t-0 bg-transparent p-2 text-base focus:outline-none"
          value={activeTab}
          onChange={(e) => onTabClick(e.target.value as OnboardingModes)}
        >
          {tabs.map((tabTitle) => {
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
