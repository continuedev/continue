import { UserCircleIcon } from "@heroicons/react/24/solid";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { ScopeSelect } from "../../components/AssistantAndOrgListbox/ScopeSelect";
import { Button } from "../../components/ui";
import { useAuth } from "../../context/Auth";
import { useAppSelector } from "../../redux/hooks";
import { selectCurrentOrg } from "../../redux/slices/profilesSlice";

export function AccountSection() {
  const { session, logout, login, organizations } = useAuth();
  const selectedOrg = useAppSelector(selectCurrentOrg);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <UserCircleIcon className="h-16 w-16 text-gray-400" />
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Not signed in</p>
          <p className="text-gray-400 mb-4">Sign in to access your account settings</p>
          <Button
            variant="outline"
            onClick={() => login(false)}
          >
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
        <div className="flex items-center gap-4">
          <UserCircleIcon className="h-16 w-16 text-gray-400" />
          <div>
            <h2 className="text-xl font-medium">Account</h2>
            <p className="text-gray-400">On-premise deployment</p>
          </div>
        </div>
        
        <div className="bg-vsc-input-background rounded-md p-4">
          <h3 className="font-medium mb-2">Account Information</h3>
          <p className="text-gray-400">Account details not available for on-premise deployments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <UserCircleIcon className="h-16 w-16 text-gray-400" />
        <div>
          <h2 className="text-xl font-medium">Account</h2>
          <p className="text-gray-400">Manage your account settings</p>
        </div>
      </div>
      
      <div className="bg-vsc-input-background rounded-md p-4">
        <h3 className="font-medium mb-4">Account Information</h3>
        <div className="space-y-4">
          <div>
            <span className="font-medium">{session.account.label}</span>
          </div>
          <div>
            <span className="text-gray-400 text-sm">{session.account.id}</span>
          </div>
          
          {organizations.length > 0 && (
            <div className="space-y-2">
              <label className="text-vsc-foreground text-sm font-medium">
                Organization
              </label>
              <div className="max-w-xs">
                <ScopeSelect />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-vsc-input-background rounded-md p-4">
        <h3 className="font-medium mb-4">Actions</h3>
        <Button
          variant="outline"
          onClick={logout}
          className="w-full"
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}