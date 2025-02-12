import { useContext } from "react";
import { Button } from "../components";
import { IdeMessengerContext } from "../context/IdeMessenger";
import GraniteLogo from "./GraniteLogo";

const GraniteOnboardingCard: React.FC = () => {
  const ideMessenger = useContext(IdeMessengerContext);

  const openGraniteSetup = () => {
    ideMessenger.post("showSetupWizard", undefined);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)]">
      <GraniteLogo alt="Granite.Code Logo" className="mb-2 h-24 w-24" />
      <h1 className="mb-4 text-xl font-bold">Welcome to Granite.Code</h1>
      <p className="mb-6 text-center">
        Local coding assistant for those who want to be in control
      </p>
      <p className="mb-6 font-medium">Follow setup to get started</p>
      <Button onClick={openGraniteSetup}>Open Setup</Button>
    </div>
  );
};

export default GraniteOnboardingCard;
