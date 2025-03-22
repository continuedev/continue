import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { AccountButton } from "./AccountButton";
import { HelpCenterSection } from "./HelpCenterSection";
import { IndexingSettingsSection } from "./IndexingSettingsSection";
import KeyboardShortcuts from "./KeyboardShortcuts";
import { UserSettingsForm } from "./UserSettingsForm";

type TabOption = {
  id: string;
  label: string;
  component: React.ReactNode;
};

function ConfigPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("general");

  const tabs: TabOption[] = [
    {
      id: "general",
      label: "General",
      component: <UserSettingsForm />,
    },
    {
      id: "indexing",
      label: "Indexing",
      component: <IndexingSettingsSection />,
    },
    {
      id: "help",
      label: "Help Center",
      component: <HelpCenterSection />,
    },
    {
      id: "shortcuts",
      label: "Shortcuts",
      component: <KeyboardShortcuts />,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-scroll">
      <PageHeader
        showBorder
        onTitleClick={() => navigate("/")}
        title="Chat"
        rightContent={<AccountButton />}
      />

      <div className="flex flex-1 flex-col">
        {/* Tab Headers */}
        <div className="flex w-full justify-center">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`px-4 py-2`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-4">
          {tabs.find((tab) => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
