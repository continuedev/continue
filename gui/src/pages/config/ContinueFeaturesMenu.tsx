import { SharedConfigSchema } from "core/config/sharedConfig";
import { HubSessionInfo } from "core/control-plane/AuthTypes";
import { useContext, useEffect } from "react";
import ToggleSwitch from "../../components/gui/Switch";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";

interface ContinueFeaturesMenuProps {
  optInNextEditFeature: boolean;
  handleUpdate: (sharedConfig: SharedConfigSchema) => void;
}

export function ContinueFeaturesMenu({
  optInNextEditFeature,
  handleUpdate,
}: ContinueFeaturesMenuProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { session } = useAuth();
  useEffect(() => {
    // Only run this effect when both optInNextEditFeature is true and session is available.
    // This effectively handles cases where there user
    // leaves the setting on before exiting vscode,
    // which leaves the toggle to be on.
    if (optInNextEditFeature && session) {
      const continueEmail = (session as HubSessionInfo)?.account?.id ?? null;
      if (continueEmail) {
        ideMessenger.post("optInNextEditFeature", {
          email: continueEmail,
          optIn: true,
        });
      }
    }
  }, []);

  const handleOptInToggle = (value: boolean) => {
    handleUpdate({
      optInNextEditFeature: value,
    });
    // Send message to VSCode extension with the email.
    const continueEmail = (session as HubSessionInfo)?.account?.id ?? null;
    if (continueEmail) {
      ideMessenger.post("optInNextEditFeature", {
        email: continueEmail,
        optIn: value,
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="my-2 text-center text-xs font-medium text-slate-400">
        🚧 INTERNAL SETTINGS 🚧
      </div>
      <div className="w-full">
        <ToggleSwitch
          isToggled={optInNextEditFeature}
          onToggle={() => handleOptInToggle(!optInNextEditFeature)}
          text="Enable Next Edit Over Autocomplete"
        />
      </div>
    </div>
  );
}
