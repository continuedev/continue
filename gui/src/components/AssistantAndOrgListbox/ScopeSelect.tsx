import {
  BuildingOfficeIcon,
  CheckIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { UserCircleIcon, UserIcon } from "@heroicons/react/24/solid";
import { useContext } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectCurrentOrg,
  setSelectedOrgId,
} from "../../redux/slices/profilesSlice";
import { ToolTip } from "../gui/Tooltip";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../ui/Listbox";

interface ScopeSelectProps {
  onSelect?: () => void;
  allowCompact?: boolean;
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

export function ScopeSelect({ onSelect, allowCompact }: ScopeSelectProps) {
  const { organizations } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedOrgId = useAppSelector(
    (state) => state.profiles.selectedOrganizationId,
  );
  const currentOrg = useAppSelector(selectCurrentOrg);
  const dispatch = useAppDispatch();

  // Always hide if single organization or none
  if (organizations.length <= 1) {
    return null;
  }

  const handleChange = (newValue: string) => {
    dispatch(setSelectedOrgId(newValue));
    ideMessenger.post("didChangeSelectedOrg", {
      id: newValue,
    });
    onSelect?.();
  };

  const selectedDisplay = currentOrg ?? {
    name: "Personal",
    iconUrl: null,
  };

  return (
    <div>
      <Listbox value={selectedOrgId} onChange={handleChange}>
        {({ open }) => (
          <div className="relative">
            <ToolTip content="" place="right" className="text-xs md:!hidden">
              <ListboxButton
                className={`text-description w-full justify-start gap-1 rounded-md border-none px-2 py-2 transition-colors ${
                  open
                    ? "bg-list-active"
                    : "hover:bg-list-active bg-transparent"
                }`}
              >
                <div className="shrink-0">
                  {getOrgIcon(selectedDisplay, "md")}
                </div>
                <div
                  className={
                    allowCompact
                      ? "hidden md:ml-1 md:flex md:min-w-0 md:flex-col md:items-start"
                      : "ml-1 flex min-w-0 flex-col items-start"
                  }
                >
                  <span className="truncate text-xs font-medium hover:brightness-110">
                    {selectedDisplay?.name || "Select Organization"}
                  </span>
                </div>
                <ChevronDownIcon
                  className={
                    allowCompact
                      ? "hidden h-3.5 w-3.5 md:ml-auto md:block"
                      : "ml-auto h-3.5 w-3.5"
                  }
                />
              </ListboxButton>
            </ToolTip>

            <ListboxOptions anchor="bottom start">
              <div className="text-description text-2xs px-3 pb-1 pt-2 font-medium">
                Organizations
              </div>
              {organizations.map((org) => (
                <ListboxOption
                  key={org.id}
                  value={org.id}
                  onClick={() => handleChange(org.id)}
                  className="px-3 py-2"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getOrgIcon(org, "md")}
                      <span className="truncate">{org.name}</span>
                    </div>
                    <div className="h-3.5 w-3.5 flex-shrink-0">
                      {selectedOrgId === org.id && (
                        <CheckIcon className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </div>
                </ListboxOption>
              ))}
            </ListboxOptions>
          </div>
        )}
      </Listbox>
    </div>
  );
}
