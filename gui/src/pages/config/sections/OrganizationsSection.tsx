import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { BuildingOfficeIcon, UserIcon } from "@heroicons/react/24/solid";
import { SerializedOrgWithProfiles } from "core/config/ProfileLifecycleManager";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useContext } from "react";
import { Button, Card, Divider } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ConfigHeader } from "../components/ConfigHeader";

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
    void ideMessenger.request("controlPlane/openUrl", {
      path: "/organizations/new",
    });
  }

  function handleConfigureOrganization(org: SerializedOrgWithProfiles) {
    let path: string;
    if (org.id === "personal" || org.slug === undefined) {
      path = "/settings";
    } else {
      path = `/organizations/${org.slug}/settings`;
    }
    void ideMessenger.request("controlPlane/openUrl", {
      path,
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
      <ConfigHeader
        title="Organizations"
        onAddClick={handleAddOrganization}
        addButtonTooltip="Add organization"
      />

      <Card>
        {organizations.map((organization, index) => (
          <div key={organization.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  {getOrgIcon(organization)}
                </div>
                <div className="flex-1">
                  <h3 className="my-2 text-sm font-medium">
                    {organization.name}
                  </h3>
                </div>
              </div>
              <Button
                onClick={() => handleConfigureOrganization(organization)}
                variant="ghost"
                size="sm"
                className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
              >
                <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
              </Button>
            </div>
            {index < organizations.length - 1 && <Divider />}
          </div>
        ))}
      </Card>
    </>
  );
}
