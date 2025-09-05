import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useContext } from "react";
import { ScopeSelect } from "../../components/AssistantAndOrgListbox/ScopeSelect";
import { ToolTip } from "../../components/gui/Tooltip";
import { Button } from "../../components/ui";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { selectCurrentOrg } from "../../redux/slices/profilesSlice";

export function AccountSection() {
  const { session, logout, login, organizations } = useAuth();
  const selectedOrg = useAppSelector(selectCurrentOrg);
  const ideMessenger = useContext(IdeMessengerContext);

  if (!session) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="text-center">
          <p className="mb-2 text-lg font-medium">Not signed in</p>
          <p className="text-description-muted mb-4">
            Sign in to access your account settings
          </p>
          <Button variant="outline" onClick={() => login(false)}>
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  // For on-prem deployments, show basic account info
  if (isOnPremSession(session)) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-medium">Account</h2>
          <p className="text-description-muted">On-premise deployment</p>
        </div>

        <div className="bg-vsc-input-background rounded-md p-4">
          <h3 className="mb-2 font-medium">Account Information</h3>
          <p className="text-description-muted">
            Account details not available for on-premise deployments
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="my-3 flex items-center justify-between">
        <div>
          <h2 className="my-0 text-xl font-medium">{session.account.label}</h2>
          <p className="text-description-muted my-0">{session.account.id}</p>
        </div>
        <ToolTip content="Sign out">
          <Button variant="outline" size="sm" onClick={logout} className="p-1">
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
          </Button>
        </ToolTip>
      </div>

      {organizations.length > 0 && (
        <div className="space-y-2">
          <label className="text-vsc-foreground text-sm font-medium">
            Current organization
          </label>
          <p className="text-description-muted !mt-1 text-xs">
            Determines what{" "}
            <span
              className="cursor-pointer underline hover:brightness-125"
              onClick={() =>
                ideMessenger.post(
                  "openUrl",
                  "https://docs.continue.dev/hub/assistants/intro",
                )
              }
            >
              agents
            </span>{" "}
            are available for you to use
          </p>
          <div className="!my-4 max-w-xs">
            <ScopeSelect />
          </div>
        </div>
      )}
    </div>
  );
}
