import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { AccountButton } from "./AccountButton";
import { HelpCenterSection } from "./HelpCenterSection";
import { IndexingSettingsSection } from "./IndexingSettingsSection";
import KeyboardShortcuts from "./KeyboardShortcuts";
import MCPServersPreview from "./MCPServersPreview";
import { UserSettingsForm } from "./UserSettingsForm";

function ConfigPage() {
  useNavigationListener();
  const navigate = useNavigate();

  return (
    <div className="overflow-y-scroll">
      <PageHeader
        showBorder
        onTitleClick={() => navigate("/")}
        title="Chat"
        rightContent={<AccountButton />}
      />

      <div className="px-4">
        <UserSettingsForm />
        <IndexingSettingsSection />
        <MCPServersPreview />
        <HelpCenterSection />
        <KeyboardShortcuts />
      </div>
    </div>
  );
}

export default ConfigPage;
