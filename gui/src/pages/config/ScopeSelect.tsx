import { Listbox } from "@headlessui/react";
import {
  BuildingOfficeIcon,
  ChevronUpDownIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../context/Auth";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { selectOrgThunk } from "../../redux";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";

export function ScopeSelect() {
  const { organizations, selectedOrganization } = useAuth();
  const selectedOrgId = useAppSelector(
    (state) => state.profiles.selectedOrganizationId,
  );
  const dispatch = useAppDispatch();

  const handleChange = (newValue: string | null) => {
    dispatch(selectOrgThunk(newValue));
  };

  useWebviewListener("didSelectOrganization", async (data) => {
    handleChange(data.orgId);
  });

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
        <Listbox.Button className="border-vsc-input-border hover:bg-vsc-input-background text-vsc-foreground bg-vsc-background flex w-full max-w-[400px] cursor-pointer items-center gap-0.5 rounded border border-solid p-2 hover:opacity-90">
          <div className="flex w-full items-center justify-between">
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
          </div>
        </Listbox.Button>

        <Listbox.Options className="bg-vsc-input-background absolute z-50 mt-1 w-full max-w-[400px] list-none overflow-auto rounded p-0 shadow-lg">
          {organizations.length > 0 && (
            <>
              <div className="text-vsc-foreground p-2 font-semibold">
                Organizations
              </div>
              {organizations.map((org) => (
                <Listbox.Option
                  key={org.id}
                  value={org.id}
                  className="text-vsc-foreground hover:bg-list-active cursor-pointer rounded p-2 text-sm hover:opacity-90"
                >
                  <div className="flex items-center gap-2">
                    {org.iconUrl ? (
                      <img src={org.iconUrl} alt="" className="h-5 w-5" />
                    ) : (
                      <BuildingOfficeIcon className="h-5 w-5" />
                    )}
                    <span>{org.name}</span>
                  </div>
                </Listbox.Option>
              ))}

              <div className="bg-lightgray mx-1 my-1 h-px" />
            </>
          )}

          <Listbox.Option
            value={null}
            className="text-vsc-foreground hover:bg-list-active cursor-pointer rounded p-2 hover:opacity-90"
          >
            <div className="flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5" />
              <span>Personal</span>
            </div>
          </Listbox.Option>
        </Listbox.Options>
      </div>
    </Listbox>
  );
}
