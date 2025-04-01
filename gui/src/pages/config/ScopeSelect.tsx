import {
  BuildingOfficeIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../components/ui/Listbox";
import { useAuth } from "../../context/Auth";
import { selectOrgThunk } from "../../redux";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";

export function ScopeSelect() {
  const { organizations, selectedOrganization } = useAuth();
  const selectedOrgId = useAppSelector(
    (state) => state.organizations.selectedOrganizationId,
  );
  const dispatch = useAppDispatch();

  const handleChange = (newValue: string | null) => {
    dispatch(selectOrgThunk(newValue));
  };

  const CurScopeEntityFallBackIcon = selectedOrgId
    ? BuildingOfficeIcon
    : UserCircleIcon;

  const selectedDisplay = selectedOrganization ?? {
    name: "Personal",
    iconUrl: null,
  };

  return (
    <Listbox value={selectedOrgId} onChange={handleChange}>
      <div className="relative">
        <ListboxButton className="hover:bg-list-active hover:text-list-active-foreground min-w-[140px] justify-between px-4 py-2 sm:min-w-[200px]">
          <div className="flex items-center gap-2">
            {selectedDisplay?.iconUrl ? (
              <img src={selectedDisplay.iconUrl} alt="" className="h-5 w-5" />
            ) : (
              <CurScopeEntityFallBackIcon className="h-5 w-5" />
            )}
            <span className="truncate">
              {selectedDisplay?.name || "Select Organization"}
            </span>
          </div>
          <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
        </ListboxButton>

        <ListboxOptions className="z-[1000] min-w-[140px] pt-0.5 sm:min-w-[200px]">
          {organizations.map((org) => (
            <ListboxOption key={org.id} value={org.id} className="py-2">
              <div className="flex items-center gap-2">
                {org.iconUrl ? (
                  <img src={org.iconUrl} alt="" className="h-5 w-5" />
                ) : (
                  <BuildingOfficeIcon className="h-5 w-5" />
                )}
                <span>{org.name}</span>
              </div>
            </ListboxOption>
          ))}

          {!!organizations.length && (
            <div className="bg-lightgray mx-1 my-1 h-px" />
          )}

          <ListboxOption value={null}>
            <div className="flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5" />
              <span>Personal</span>
            </div>
          </ListboxOption>
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
