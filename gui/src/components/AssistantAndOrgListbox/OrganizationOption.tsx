import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import {
  BuildingOfficeIcon,
  UserCircleIcon,
  UserIcon,
} from "@heroicons/react/24/solid";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setSelectedOrgId } from "../../redux/slices/profilesSlice";
import { CONFIG_ROUTES } from "../../util/navigation";
import { Button, ListboxOption } from "../ui";

interface OrganizationOptionProps {
  organization: { id: string; name: string; iconUrl?: string | null };
  onClose: () => void;
}

function getOrgIcon(
  org: { name: string; iconUrl?: string | null },
  size: "sm" | "md" = "sm",
) {
  const sizeClasses = size === "sm" ? "h-3.5 w-3.5" : "xs:h-4 xs:w-4 h-3 w-3";

  if (org.iconUrl) {
    return (
      <img
        src={org.iconUrl}
        alt=""
        className={`${sizeClasses} flex-shrink-0 rounded-full`}
      />
    );
  }

  const IconComponent =
    org.name === "Personal"
      ? size === "md"
        ? UserIcon
        : UserCircleIcon
      : BuildingOfficeIcon;
  return <IconComponent className={`${sizeClasses} flex-shrink-0`} />;
}

export function OrganizationOption({
  organization,
  onClose,
}: OrganizationOptionProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedOrgId = useAppSelector(
    (state) => state.profiles.selectedOrganizationId,
  );
  const isSelected = selectedOrgId === organization.id;

  function handleOptionClick() {
    dispatch(setSelectedOrgId(organization.id));
    ideMessenger.post("didChangeSelectedOrg", {
      id: organization.id,
    });
    onClose();
  }

  return (
    <ListboxOption
      value={organization.id}
      onClick={handleOptionClick}
      fontSizeModifier={-2}
      className={`group ${isSelected ? "bg-list-active text-list-active-foreground" : ""}`}
    >
      <div className="flex w-full items-center justify-between gap-10 py-0.5">
        <div className="flex w-full items-center gap-3">
          <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
            {getOrgIcon(organization, "sm")}
          </div>
          <span
            className={`line-clamp-1 flex-1 ${isSelected ? "font-semibold" : ""}`}
          >
            {organization.name}
          </span>
        </div>
        <div className="flex flex-row items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-description-muted hover:enabled:text-foreground my-0 h-4 w-4 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              navigate(CONFIG_ROUTES.ORGANIZATIONS);
              onClose(); // Close the listbox
            }}
          >
            <Cog6ToothIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </ListboxOption>
  );
}
