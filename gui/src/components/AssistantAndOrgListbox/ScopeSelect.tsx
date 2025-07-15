import {
  BuildingOfficeIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { useContext } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectCurrentOrg,
  setSelectedOrgId,
} from "../../redux/slices/profilesSlice";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../ui/Listbox";

interface ScopeSelectProps {
  onSelect?: () => void;
}

function getOrgIcon(org: { name: string; iconUrl?: string | null }) {
  if (org.iconUrl) {
    return (
      <img src={org.iconUrl} alt="" className="h-3.5 w-3.5 rounded-full" />
    );
  }

  const IconComponent =
    org.name === "Personal" ? UserCircleIcon : BuildingOfficeIcon;
  return <IconComponent className="h-3.5 w-3.5" />;
}

export function ScopeSelect({ onSelect }: ScopeSelectProps) {
  const { organizations } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedOrgId = useAppSelector(
    (state) => state.profiles.selectedOrganizationId,
  );
  const currentOrg = useAppSelector(selectCurrentOrg);
  const dispatch = useAppDispatch();

  const handleChange = (newValue: string) => {
    // optimisitic update
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
    <Listbox value={selectedOrgId} onChange={handleChange}>
      <div className="relative">
        <ListboxButton className="hover:bg-list-active hover:text-list-active-foreground w-full min-w-[140px] justify-between px-4 py-2 sm:min-w-[200px]">
          <div className="flex items-center gap-2">
            {getOrgIcon(selectedDisplay)}
            <span className="truncate">
              {selectedDisplay?.name || "Select Organization"}
            </span>
          </div>
          <ChevronUpDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </ListboxButton>

        <ListboxOptions className="z-[1000] min-w-[140px] pt-0.5 sm:min-w-[200px]">
          {organizations.map((org) => (
            <ListboxOption key={org.id} value={org.id} className="py-2">
              <div className="flex items-center gap-2">
                {getOrgIcon(org)}
                <span>{org.name}</span>
              </div>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
