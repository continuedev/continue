import { SharedConfigSchema } from "core/config/sharedConfig";
import { HubSessionInfo } from "core/control-plane/AuthTypes";
import { useContext } from "react";
import ToggleSwitch from "../../components/gui/Switch";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";

interface ContinueFeaturesMenuProps {
  optInContinueFeature: boolean;
  handleUpdate: (sharedConfig: SharedConfigSchema) => void;
}

export function ContinueFeaturesMenu({
  optInContinueFeature,
  handleUpdate,
}: ContinueFeaturesMenuProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { session } = useAuth();

  const handleOptInToggle = (value: boolean) => {
    handleUpdate({
      optInContinueFeature: value,
    });
    // Send message to VSCode extension with the email
    const continueEmail = (session as HubSessionInfo)?.account?.id ?? null;
    if (continueEmail) {
      ideMessenger.post("optInContinueFeature", {
        email: continueEmail,
        optIn: value,
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="my-2 text-center text-xs font-medium text-slate-400">
        🚧 CHECKPOINT CHARLIE 🚧
      </div>
      <div className="w-full">
        <ToggleSwitch
          isToggled={optInContinueFeature}
          onToggle={() => handleOptInToggle(!optInContinueFeature)}
          text="Opt In to Special Feature"
        />
      </div>
    </div>
  );
}
