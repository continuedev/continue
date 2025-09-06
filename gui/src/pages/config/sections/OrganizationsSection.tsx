import { Cog6ToothIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { BuildingOfficeIcon, UserIcon } from "@heroicons/react/24/solid";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useContext } from "react";
import { Button, Card, Divider } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

function getOrgIcon(org: { name: string; iconUrl?: string | null }) {
  if (org.iconUrl) {
    return (
      <img
        src={org.iconUrl}
        alt=""
        className="h-5 w-5 flex-shrink-0 rounded-full"
      />
    );
  }

  const IconComponent = org.name === "Personal" ? UserIcon : BuildingOfficeIcon;
  return <IconComponent className="h-5 w-5 flex-shrink-0" />;
}

export function OrganizationsSection() {
  const { organizations, session } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);

  const shouldRenderOrgInfo =
    session && organizations.length > 1 && !isOnPremSession(session);

  function handleAddOrganization() {
    ideMessenger.request("controlPlane/openUrl", {
      path: "/organizations/new",
    });
  }

  function handleConfigureOrganization(orgId: string) {
    ideMessenger.request("controlPlane/openUrl", {
      path: `/organizations/${orgId}/settings`,
    });
  }

  if (!shouldRenderOrgInfo) {
    return (
      <>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="mb-0 text-xl font-semibold">Organizations</h2>
          </div>
        </div>
        <Card>
          <div className="text-description py-8 text-center text-sm">
            Organizations are only available with cloud accounts. Sign in to
            manage organizations.
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="mb-0 text-xl font-semibold">Organizations</h2>
        </div>
        <Button
          onClick={handleAddOrganization}
          variant="ghost"
          size="sm"
          className="my-0 h-8 w-8 p-0"
        >
          <PlusCircleIcon className="text-description h-5 w-5" />
        </Button>
      </div>

      <Card>
        {organizations.map((organization, index) => (
          <div key={organization.id}>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  {getOrgIcon(organization)}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium">{organization.name}</h3>
                </div>
              </div>
              <Button
                onClick={() => handleConfigureOrganization(organization.id)}
                variant="ghost"
                size="sm"
                className="my-0 h-8 w-8 p-0"
              >
                <Cog6ToothIcon className="text-description h-4 w-4" />
              </Button>
            </div>
            {index < organizations.length - 1 && <Divider />}
          </div>
        ))}
      </Card>
    </>
  );
}
