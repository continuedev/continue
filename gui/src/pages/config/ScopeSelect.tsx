import { Listbox } from "@headlessui/react";
import {
  ChevronDownIcon,
  UserCircleIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

export function ScopeSelect() {
  const [value, setValue] = useState("");
  const [showAbove, setShowAbove] = useState(false);

  return (
    <Listbox value={value} onChange={setValue}>
      <div className="relative">
        <Listbox.Button className="border-vsc-foreground text-vsc-foreground hover:bg-vsc-background flex w-full cursor-pointer items-center gap-0.5 rounded border bg-transparent p-2 hover:opacity-90">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <CubeIcon className="h-5 w-5" />
              <span className="truncate">Continue</span>
            </div>
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </div>
        </Listbox.Button>

        <Listbox.Options
          className={`bg-vsc-input-background absolute z-50 mt-1 w-full min-w-[200px] list-none overflow-auto rounded p-1 shadow-lg ${showAbove ? "bottom-full mb-1" : ""}`}
        >
          <div className="text-vsc-foreground p-2 text-[13px] font-medium">
            Organizations
          </div>

          <Listbox.Option
            value="continue"
            className="text-vsc-foreground hover:bg-lightgray/20 cursor-pointer rounded p-1.5 hover:opacity-90"
          >
            <div className="flex items-center gap-2">
              <CubeIcon className="h-5 w-5" />
              <span>Continue</span>
            </div>
          </Listbox.Option>

          <div className="bg-lightgray mx-1 my-1 h-px" />

          <Listbox.Option
            value="personal"
            className="text-vsc-foreground hover:bg-lightgray/20 cursor-pointer rounded p-1.5 hover:opacity-90"
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
