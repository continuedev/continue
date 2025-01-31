// gui/src/pages/config/ScopeSelect.tsx

import { Listbox } from "@headlessui/react";
import {
  ChevronDownIcon,
  UserCircleIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { useAuth } from "../../context/Auth";
import { useDispatch } from "react-redux";
import { setSelectedOrganizationId } from "../../redux/slices/sessionSlice";

export function ScopeSelect() {
  const { organizations, selectedOrganization } = useAuth();
  const [value, setValue] = useState<string>(
    selectedOrganization?.id || "personal",
  );
  const dispatch = useDispatch();

  const handleChange = (newValue: string) => {
    setValue(newValue);
    dispatch(
      setSelectedOrganizationId(newValue === "personal" ? null : newValue),
    );
  };
  const selectedDisplay =
    value === "personal"
      ? { name: "Personal", iconUrl: null }
      : organizations.find((org) => org.id === value);

  return (
    <Listbox value={value} onChange={handleChange}>
      <div className="relative">
        <Listbox.Button className="border-vsc-foreground text-vsc-foreground hover:bg-vsc-background flex w-full cursor-pointer items-center gap-0.5 rounded border bg-transparent p-2 hover:opacity-90">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedDisplay?.iconUrl ? (
                <img src={selectedDisplay.iconUrl} alt="" className="h-5 w-5" />
              ) : (
                <UserCircleIcon className="h-5 w-5" />
              )}
              <span className="truncate">
                {selectedDisplay?.name || "Select Organization"}
              </span>
            </div>
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </div>
        </Listbox.Button>

        <Listbox.Options className="bg-vsc-input-background absolute z-50 mt-1 w-full min-w-[200px] list-none overflow-auto rounded p-0 shadow-lg">
          <div className="text-vsc-foreground p-2 font-semibold">
            Organizations
          </div>
          {organizations.map((org) => (
            <Listbox.Option
              key={org.id}
              value={org.id}
              className="text-vsc-foreground hover:bg-lightgray/20 cursor-pointer rounded p-2 hover:opacity-90"
            >
              <div className="flex items-center gap-2">
                {org.iconUrl ? (
                  <img src={org.iconUrl} alt="" className="h-5 w-5" />
                ) : (
                  <CubeIcon className="h-5 w-5" />
                )}
                <span>{org.name}</span>
              </div>
            </Listbox.Option>
          ))}

          <div className="bg-lightgray mx-1 my-1 h-px" />

          <Listbox.Option
            value="personal"
            className="text-vsc-foreground hover:bg-lightgray/20 cursor-pointer rounded p-2 hover:opacity-90"
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
