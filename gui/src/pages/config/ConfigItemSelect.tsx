/**
 * A component that displays config items either as tabs (on large screens) or a popover select (on small screens)
 */
interface ConfigItemSelectProps {
  items: {
    id: string;
    label: string;
    icon: React.ReactNode;
  }[];
  activeId: string;
  onSelect: (id: string) => void;
}

import { Popover } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import PopoverTransition from "../../components/mainInput/InputToolbar/bottom/PopoverTransition";
import { fontSize } from "../../util";

export function ConfigItemSelect({
  items,
  activeId,
  onSelect,
}: ConfigItemSelectProps) {
  const activeItem = items.find((item) => item.id === activeId);

  const tabContent = (
    <div className="hidden border-0 border-b-[1px] border-solid border-b-zinc-700 p-0.5 sm:flex sm:justify-center md:grid md:grid-cols-2 md:gap-x-2">
      {items.map((item) => (
        <div
          style={{ fontSize: fontSize(-2) }}
          key={item.id}
          className={`hover:bg-vsc-input-background flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 ${
            activeId === item.id ? "" : "text-gray-400"
          }`}
          onClick={() => onSelect(item.id)}
        >
          {item.icon}
          {item.label}
        </div>
      ))}
    </div>
  );

  // Render popover on smaller screens
  const popoverContent = (
    <div className="mt-2 px-1.5 sm:hidden">
      <Popover className="relative">
        <Popover.Button
          className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-700 px-3 py-2"
          style={{ fontSize: fontSize(-2) }}
        >
          <div className="flex items-center gap-2">
            {activeItem?.icon}
            <span>{activeItem?.label}</span>
          </div>
          <ChevronDownIcon className="h-4 w-4" />
        </Popover.Button>

        <PopoverTransition>
          <Popover.Panel className="bg-vsc-input-background absolute z-10 mt-1 w-full rounded-md border border-zinc-700 py-1">
            {items.map((item) => (
              <div
                key={item.id}
                className={`hover:bg-vsc-input-background flex cursor-pointer items-center gap-2 px-3 py-2 ${
                  activeId === item.id ? "bg-vsc-input-background" : ""
                }`}
                onClick={() => {
                  onSelect(item.id);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </div>
            ))}
          </Popover.Panel>
        </PopoverTransition>
      </Popover>
    </div>
  );

  return (
    <>
      {tabContent}
      {popoverContent}
    </>
  );
}
