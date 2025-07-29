import {
  BoltIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { fontSize } from "../../util";
import { AccountButton } from "./AccountButton";
import { HelpCenterSection } from "./HelpCenterSection";
import { IndexingSettingsSection } from "./IndexingSettingsSection";
import KeyboardShortcuts from "./KeyboardShortcuts";
import { UserSettingsForm } from "./UserSettingsForm";

type TabOption = {
  id: string;
  label: string;
  component: React.ReactNode;
  icon: React.ReactNode;
};

function ConfigPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("settings");

  const tabs: TabOption[] = [
    {
      id: "settings",
      label: "Settings",
      component: <UserSettingsForm />,
      icon: <Cog6ToothIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
    {
      id: "indexing",
      label: "Indexing",
      component: <IndexingSettingsSection />,
      icon: <CircleStackIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
    {
      id: "help",
      label: "Help",
      component: <HelpCenterSection />,
      icon: (
        <QuestionMarkCircleIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
      ),
    },
    {
      id: "shortcuts",
      label: "Shortcuts",
      component: <KeyboardShortcuts />,
      icon: <BoltIcon className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="bg-vsc-background sticky top-0 z-10">
        <PageHeader
          showBorder
          onTitleClick={() => navigate("/")}
          title="Chat"
          rightContent={<AccountButton />}
        />

        {/* Tab Headers */}
        <div className="bg-vsc-input-background grid cursor-pointer grid-cols-2 border-0 border-b-[1px] border-solid border-b-zinc-700 p-0.5 sm:flex sm:justify-center md:gap-x-2">
          {tabs.map((tab) => (
            <div
              style={{
                fontSize: fontSize(-2),
              }}
              key={tab.id}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 hover:brightness-125 ${
                activeTab === tab.id ? "" : "text-gray-400"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4">
        {tabs.find((tab) => tab.id === activeTab)?.component}
      </div>
    </div>
  );
}

export default ConfigPage;
